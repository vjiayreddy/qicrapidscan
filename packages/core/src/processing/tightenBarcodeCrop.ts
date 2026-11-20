export interface ContentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How to tighten a YOLO ROI based on symbology. */
export type TightenSymbolKind = "linear" | "matrix" | "pdf417";

export interface TightenBarcodeCropOptions {
  /** Extra margin around detected content, in pixels. Default 2. */
  marginPx?: number;
  /**
   * Symbology-aware tighten strategy.
   * - `linear`: Code128 / UPC — thin high-edge bar strip (drop label text)
   * - `matrix`: DataMatrix / QR — near-square ink bbox
   * - `pdf417`: stacked 2D — taller band, moderate text reject
   */
  symbolKind?: TightenSymbolKind;
  /** Min luma step to count as a horizontal edge. Default depends on kind. */
  edgeDelta?: number;
  /** Row edge score vs peak for linear/pdf417. Default depends on kind. */
  edgePeakRatio?: number;
  /** Absolute minimum normalized edge score. Default depends on kind. */
  minEdgeNorm?: number;
  /** Reject shrinks that leave less than this fraction of the ROI area. Default 0.03. */
  minAreaRatio?: number;
  /** Reject if tightened width/height falls below this many pixels. Default 6. */
  minEdgePx?: number;
}

/**
 * Map a YOLO / result label to the tighten strategy.
 */
export function symbolKindFromLabel(
  label: string | undefined,
): TightenSymbolKind {
  const key = (label ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (
    key.includes("datamatrix") ||
    key.includes("qr") ||
    key.includes("aztec")
  ) {
    return "matrix";
  }
  if (key.includes("pdf417") || key.includes("pdf")) {
    return "pdf417";
  }
  return "linear";
}

/**
 * Find a tight content bbox inside a YOLO ROI, tuned per symbology.
 */
export function tightenContentRectFromImageData(
  imageData: ImageData,
  options: TightenBarcodeCropOptions = {},
): ContentRect | null {
  const width = imageData.width;
  const height = imageData.height;
  if (width < 8 || height < 8) return null;

  const kind = options.symbolKind ?? "linear";
  const marginPx = Math.max(0, options.marginPx ?? 2);
  const minAreaRatio = options.minAreaRatio ?? 0.03;
  const minEdgePx = options.minEdgePx ?? 6;

  const data = imageData.data;
  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    luma[p] =
      data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
  }

  const threshold = otsuThreshold(luma);
  const inkCutoff = Math.min(
    threshold + 1,
    estimateBackgroundLuma(luma, width, height) - 24,
  );
  if (inkCutoff <= 8) return null;

  const ink = new Uint8Array(width * height);
  let inkCount = 0;
  for (let p = 0; p < luma.length; p += 1) {
    if (luma[p]! < inkCutoff) {
      ink[p] = 1;
      inkCount += 1;
    }
  }
  if (inkCount < Math.max(24, width * height * 0.003)) return null;

  if (kind === "matrix") {
    return tightenMatrix(ink, width, height, marginPx, minAreaRatio, minEdgePx);
  }

  const edgeDelta =
    options.edgeDelta ?? (kind === "pdf417" ? 22 : 28);
  const edgePeakRatio =
    options.edgePeakRatio ?? (kind === "pdf417" ? 0.45 : 0.65);
  const minEdgeNorm =
    options.minEdgeNorm ?? (kind === "pdf417" ? 0.05 : 0.08);

  return tightenLinearLike({
    luma,
    ink,
    width,
    height,
    marginPx,
    edgeDelta,
    edgePeakRatio,
    minEdgeNorm,
    minAreaRatio,
    minEdgePx,
    kind,
  });
}

export function mapLocalRectToSource(
  local: ContentRect,
  roi: ContentRect,
): ContentRect {
  return {
    x: roi.x + local.x,
    y: roi.y + local.y,
    width: local.width,
    height: local.height,
  };
}

function tightenMatrix(
  ink: Uint8Array,
  width: number,
  height: number,
  marginPx: number,
  minAreaRatio: number,
  minEdgePx: number,
): ContentRect | null {
  const rowDensity = new Float32Array(height);
  const colDensity = new Float32Array(width);

  for (let y = 0; y < height; y += 1) {
    let rowInk = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x += 1) {
      if (ink[rowOff + x]) {
        rowInk += 1;
        colDensity[x]! += 1;
      }
    }
    rowDensity[y] = rowInk / width;
  }
  for (let x = 0; x < width; x += 1) {
    colDensity[x] = colDensity[x]! / height;
  }

  // Matrix symbols are dense blobs — span ink with a moderate gate.
  const rowBand = inkSpan(rowDensity, 0.28, 0.08);
  const colBand = inkSpan(colDensity, 0.28, 0.08);
  if (!rowBand || !colBand) return null;

  let x0 = Math.max(0, colBand.start - marginPx);
  let y0 = Math.max(0, rowBand.start - marginPx);
  let x1 = Math.min(width - 1, colBand.end + marginPx);
  let y1 = Math.min(height - 1, rowBand.end + marginPx);

  let outW = x1 - x0 + 1;
  let outH = y1 - y0 + 1;
  if (outW < minEdgePx || outH < minEdgePx) return null;
  if (outW * outH < width * height * minAreaRatio) return null;

  // Nudge toward square so finder/L-pattern isn't clipped unevenly.
  const side = Math.max(outW, outH);
  if (side / Math.min(outW, outH) <= 1.35) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    x0 = Math.max(0, Math.round(cx - side / 2));
    y0 = Math.max(0, Math.round(cy - side / 2));
    x1 = Math.min(width - 1, x0 + side - 1);
    y1 = Math.min(height - 1, y0 + side - 1);
    x0 = Math.max(0, x1 - side + 1);
    y0 = Math.max(0, y1 - side + 1);
    outW = x1 - x0 + 1;
    outH = y1 - y0 + 1;
  }

  return { x: x0, y: y0, width: outW, height: outH };
}

function tightenLinearLike(args: {
  luma: Float32Array;
  ink: Uint8Array;
  width: number;
  height: number;
  marginPx: number;
  edgeDelta: number;
  edgePeakRatio: number;
  minEdgeNorm: number;
  minAreaRatio: number;
  minEdgePx: number;
  kind: "linear" | "pdf417";
}): ContentRect | null {
  const {
    luma,
    ink,
    width,
    height,
    marginPx,
    edgeDelta,
    edgePeakRatio,
    minEdgeNorm,
    minAreaRatio,
    minEdgePx,
    kind,
  } = args;

  const rowScore = new Float32Array(height);
  const maxEdges = Math.max(1, width - 1);
  for (let y = 0; y < height; y += 1) {
    const rowOff = y * width;
    let edges = 0;
    for (let x = 1; x < width; x += 1) {
      if (Math.abs(luma[rowOff + x]! - luma[rowOff + x - 1]!) >= edgeDelta) {
        edges += 1;
      }
    }
    rowScore[y] = edges / maxEdges;
  }

  const peak = maxValue(rowScore);
  if (peak < minEdgeNorm) return null;

  // Grow from the peak row outward — avoids gluing sparse label text
  // ("NP GCYA") into a tall band with the barcode strip.
  const coreRatio = kind === "pdf417" ? 0.55 : 0.72;
  const shoulderRatio = kind === "pdf417" ? 0.42 : 0.62;
  const coreGate = Math.max(minEdgeNorm, peak * Math.max(edgePeakRatio, coreRatio));
  const shoulderGate = Math.max(minEdgeNorm, peak * shoulderRatio);

  let peakRow = 0;
  for (let y = 0; y < height; y += 1) {
    if (rowScore[y]! > rowScore[peakRow]!) peakRow = y;
  }

  let yStart = peakRow;
  let yEnd = peakRow;
  while (yStart > 0 && rowScore[yStart - 1]! >= coreGate) yStart -= 1;
  while (yEnd < height - 1 && rowScore[yEnd + 1]! >= coreGate) yEnd += 1;
  while (yStart > 0 && rowScore[yStart - 1]! >= shoulderGate) yStart -= 1;
  while (yEnd < height - 1 && rowScore[yEnd + 1]! >= shoulderGate) yEnd += 1;

  const bandHeight = yEnd - yStart + 1;
  if (bandHeight < 3) return null;
  // Linear barcodes are thin strips — reject if we still captured most of a tall ROI
  // (usually means label text was merged in).
  if (kind === "linear" && height >= 24 && bandHeight > height * 0.55) {
    // Fall back to a tighter core-only band around the peak.
    yStart = peakRow;
    yEnd = peakRow;
    while (yStart > 0 && rowScore[yStart - 1]! >= coreGate) yStart -= 1;
    while (yEnd < height - 1 && rowScore[yEnd + 1]! >= coreGate) yEnd += 1;
    if (yEnd - yStart + 1 < 3) return null;
  }

  const colInk = new Float32Array(width);
  for (let y = yStart; y <= yEnd; y += 1) {
    const rowOff = y * width;
    for (let x = 0; x < width; x += 1) {
      if (ink[rowOff + x]) colInk[x]! += 1;
    }
  }
  for (let x = 0; x < width; x += 1) {
    colInk[x] = colInk[x]! / bandHeight;
  }

  const colPeakRatio = kind === "pdf417" ? 0.22 : 0.35;
  const colMin = kind === "pdf417" ? 0.06 : 0.12;
  const colBand = inkSpan(colInk, colPeakRatio, colMin);
  if (!colBand) return null;

  let x0 = Math.max(0, colBand.start - marginPx);
  let y0 = Math.max(0, yStart - marginPx);
  let x1 = Math.min(width - 1, colBand.end + marginPx);
  let y1 = Math.min(height - 1, yEnd + marginPx);

  let outW = x1 - x0 + 1;
  let outH = y1 - y0 + 1;

  if (outW < minEdgePx || outH < minEdgePx) return null;
  if (outW * outH < width * height * minAreaRatio) return null;
  if (
    kind === "linear" &&
    width >= 48 &&
    width / height >= 1.6 &&
    outW < width * 0.3
  ) {
    return null;
  }

  return { x: x0, y: y0, width: outW, height: outH };
}

function maxValue(values: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i]! > peak) peak = values[i]!;
  }
  return peak;
}

function estimateBackgroundLuma(
  luma: Float32Array,
  width: number,
  height: number,
): number {
  const samples: number[] = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 32))) {
    samples.push(luma[x]!);
    samples.push(luma[(height - 1) * width + x]!);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 32))) {
    samples.push(luma[y * width]!);
    samples.push(luma[y * width + width - 1]!);
  }
  samples.sort((a, b) => a - b);
  const idx = Math.min(
    samples.length - 1,
    Math.max(0, Math.floor(samples.length * 0.85)),
  );
  return samples[idx] ?? 200;
}

function otsuThreshold(luma: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < luma.length; i += 1) {
    const bin = Math.min(255, Math.max(0, Math.round(luma[i]!)));
    hist[bin]! += 1;
  }

  const total = luma.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i]!;

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}

function peakAndGate(
  density: Float32Array,
  peakRatio: number,
  minDensity: number,
): { peak: number; gate: number } | null {
  const peak = maxValue(density);
  if (peak < minDensity) return null;
  return { peak, gate: Math.max(minDensity, peak * peakRatio) };
}

function inkSpan(
  density: Float32Array,
  peakRatio: number,
  minDensity: number,
): { start: number; end: number } | null {
  const stats = peakAndGate(density, peakRatio, minDensity);
  if (!stats) return null;
  const { gate } = stats;

  let start = -1;
  let end = -1;
  for (let i = 0; i < density.length; i += 1) {
    if (density[i]! < gate) continue;
    if (start < 0) start = i;
    end = i;
  }
  if (start < 0 || end < start) return null;
  return { start, end };
}
