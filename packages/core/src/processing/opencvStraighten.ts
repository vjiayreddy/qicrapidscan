import type { OpenCvRuntime } from "./opencvReady.js";

type CvMat = {
  cols: number;
  rows: number;
  data: Uint8Array;
  delete: () => void;
  data32S?: Int32Array;
  data32F?: Float32Array;
};

type CvPoint = { x: number; y: number };

/** Loose OpenCV surface for contour / warp APIs (not all typed in opencvReady). */
type CvStraighten = OpenCvRuntime & {
  MatVector: new () => {
    size: () => number;
    get: (i: number) => CvMat;
    delete: () => void;
  };
  findContours: (...args: unknown[]) => void;
  contourArea: (contour: unknown, oriented?: boolean) => number;
  arcLength: (curve: unknown, closed: boolean) => number;
  approxPolyDP: (
    curve: unknown,
    approxCurve: unknown,
    epsilon: number,
    closed: boolean,
  ) => void;
  minAreaRect: (points: unknown) => {
    center: CvPoint;
    size: { width: number; height: number };
    angle: number;
  };
  boxPoints: (rect: unknown, points?: unknown) => Float32Array | void;
  getPerspectiveTransform: (src: unknown, dst: unknown) => CvMat;
  warpPerspective: (...args: unknown[]) => void;
  RETR_LIST: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  INTER_LINEAR: number;
  BORDER_REPLICATE: number;
  CV_32FC2: number;
  matFromArray: (
    rows: number,
    cols: number,
    type: number,
    array: number[] | Float32Array,
  ) => CvMat;
};

function safeDelete(mat: { delete: () => void } | null | undefined): void {
  if (!mat) return;
  try {
    mat.delete();
  } catch {
    // already freed
  }
}

function orderQuadPoints(points: CvPoint[]): [CvPoint, CvPoint, CvPoint, CvPoint] {
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0]!, top[1]!, bottom[1]!, bottom[0]!]; // TL, TR, BR, BL
}

function readApproxPoints(approx: CvMat): CvPoint[] | null {
  const pts: CvPoint[] = [];
  if (approx.data32S && approx.rows >= 4) {
    for (let i = 0; i < 4; i += 1) {
      pts.push({
        x: approx.data32S[i * 2]!,
        y: approx.data32S[i * 2 + 1]!,
      });
    }
    return pts;
  }
  return null;
}

function quadFromMinAreaRect(
  cv: CvStraighten,
  contour: CvMat,
): CvPoint[] | null {
  try {
    const rect = cv.minAreaRect(contour);
    const w = rect.size.width;
    const h = rect.size.height;
    if (w < 12 || h < 12) return null;
    const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
    if (ratio > 1.55) return null;

    // Prefer RotatedRect.points when available; fall back to boxPoints buffer.
    const anyCv = cv as CvStraighten & {
      RotatedRect?: { points: (r: unknown) => CvPoint[] };
    };
    if (anyCv.RotatedRect?.points) {
      const pts = anyCv.RotatedRect.points(rect);
      if (pts?.length === 4) return pts;
    }

    const buf = new Float32Array(8);
    const boxMat = cv.matFromArray(4, 1, cv.CV_32FC2, buf);
    try {
      cv.boxPoints(rect, boxMat);
      const data = boxMat.data32F ?? new Float32Array(boxMat.data.buffer);
      return [
        { x: data[0]!, y: data[1]! },
        { x: data[2]!, y: data[3]! },
        { x: data[4]!, y: data[5]! },
        { x: data[6]!, y: data[7]! },
      ];
    } finally {
      safeDelete(boxMat);
    }
  } catch {
    return null;
  }
}

function scoreQuad(
  points: CvPoint[],
  imageArea: number,
): { area: number; ok: boolean } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const area = Math.max(1, w * h);
  const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  const frac = area / Math.max(1, imageArea);
  const ok = ratio <= 1.55 && frac >= 0.04 && frac <= 0.98 && w >= 16 && h >= 16;
  return { area, ok };
}

/**
 * Score a candidate as the DataMatrix *symbol* (not the outer padded crop).
 * Prefers mid-sized centered squares — rejects near-full-frame outer boxes.
 */
function scoreSymbolQuad(
  points: CvPoint[],
  imageArea: number,
  imageW: number,
  imageH: number,
  gray: CvMat,
): number {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(imageW - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(imageH - 1, Math.ceil(Math.max(...ys)));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const area = w * h;
  const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  const frac = area / Math.max(1, imageArea);
  if (ratio > 1.45 || frac < 0.12 || frac > 0.82 || w < 18 || h < 18) {
    return -1;
  }

  const squareScore = 1 - Math.abs(1 - ratio);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const centerScore =
    1 -
    Math.min(
      1,
      Math.hypot(cx - imageW / 2, cy - imageH / 2) /
        (Math.hypot(imageW, imageH) * 0.5 || 1),
    );
  // Penalize near-full-frame quads (outer crop / quiet-zone box).
  const sizeScore = frac > 0.72 ? 1.2 - frac : 0.35 + frac;

  // L-finder prior: left column + bottom row should be darker than average.
  let lDark = 0;
  let lCount = 0;
  let mean = 0;
  let meanCount = 0;
  const data = gray.data;
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.08));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= minX + band && x <= maxX; x += 1) {
      lDark += data[y * imageW + x]!;
      lCount += 1;
    }
  }
  for (let y = Math.max(minY, maxY - band); y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      lDark += data[y * imageW + x]!;
      lCount += 1;
    }
  }
  for (let y = minY; y <= maxY; y += Math.max(1, Math.floor(h / 8))) {
    for (let x = minX; x <= maxX; x += Math.max(1, Math.floor(w / 8))) {
      mean += data[y * imageW + x]!;
      meanCount += 1;
    }
  }
  const lAvg = lCount > 0 ? lDark / lCount : 128;
  const mAvg = meanCount > 0 ? mean / meanCount : 128;
  const lFinderScore = lAvg < mAvg - 8 ? 1.15 : lAvg < mAvg ? 1.0 : 0.75;

  return (squareScore * 2.2 + centerScore + sizeScore) * lFinderScore;
}

function warpQuadToSquare(
  cv: CvStraighten,
  gray: CvMat,
  ordered: [CvPoint, CvPoint, CvPoint, CvPoint],
  side: number,
): CvMat | null {
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ordered[0].x,
    ordered[0].y,
    ordered[1].x,
    ordered[1].y,
    ordered[2].x,
    ordered[2].y,
    ordered[3].x,
    ordered[3].y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    side - 1,
    0,
    side - 1,
    side - 1,
    0,
    side - 1,
  ]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat() as CvMat;
  try {
    cv.warpPerspective(
      gray as never,
      warped as never,
      M as never,
      new cv.Size(side, side),
      cv.INTER_LINEAR ?? cv.INTER_CUBIC,
      cv.BORDER_REPLICATE ?? cv.BORDER_CONSTANT,
    );
    return warped;
  } catch {
    safeDelete(warped);
    return null;
  } finally {
    safeDelete(srcTri);
    safeDelete(dstTri);
    safeDelete(M);
  }
}

type ContourScanMode = "largest" | "symbol";

function findBestQuad(
  cv: CvStraighten,
  gray: CvMat,
  mode: ContourScanMode,
): [CvPoint, CvPoint, CvPoint, CvPoint] | null {
  const binary = new cv.Mat() as CvMat;
  const closed = new cv.Mat() as CvMat;
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat() as CvMat;
  let kernel: { delete: () => void } | null = null;

  try {
    const threshInv = cv.THRESH_BINARY_INV ?? 1;
    cv.adaptiveThreshold(
      gray as never,
      binary as never,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      threshInv,
      31,
      7,
    );

    // Merge DataMatrix modules into one solid symbol blob.
    const k = Math.max(3, Math.round(Math.min(gray.cols, gray.rows) / 28) | 1);
    const cvMorph = cv as CvStraighten & {
      getStructuringElement?: (shape: number, size: unknown) => {
        delete: () => void;
      };
      morphologyEx?: (...args: unknown[]) => void;
      MORPH_RECT?: number;
      MORPH_CLOSE?: number;
    };
    if (
      typeof cvMorph.getStructuringElement === "function" &&
      typeof cvMorph.morphologyEx === "function"
    ) {
      kernel = cvMorph.getStructuringElement(
        cvMorph.MORPH_RECT ?? 0,
        new cv.Size(k, k),
      );
      cvMorph.morphologyEx(
        binary as never,
        closed as never,
        cvMorph.MORPH_CLOSE ?? 3,
        kernel,
      );
    } else {
      cv.resize(
        binary as never,
        closed as never,
        new cv.Size(gray.cols, gray.rows),
        0,
        0,
        cv.INTER_CUBIC,
      );
    }

    cv.findContours(
      closed,
      contours,
      hierarchy,
      mode === "symbol"
        ? (cv.RETR_EXTERNAL ?? 0)
        : (cv.RETR_LIST ?? 1),
      cv.CHAIN_APPROX_SIMPLE ?? 2,
    );

    const imageArea = gray.cols * gray.rows;
    let bestLargest: { points: CvPoint[]; area: number } | null = null;
    let bestSymbol: { points: CvPoint[]; score: number } | null = null;

    for (let i = 0; i < contours.size(); i += 1) {
      const cnt = contours.get(i);
      const area = Math.abs(cv.contourArea(cnt));
      if (area < imageArea * 0.04 || area > imageArea * 0.98) continue;

      let points: CvPoint[] | null = null;
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat() as CvMat;
      try {
        cv.approxPolyDP(cnt, approx, 0.04 * peri, true);
        if ((approx.rows ?? 0) === 4) {
          points = readApproxPoints(approx);
        }
      } finally {
        safeDelete(approx);
      }

      if (!points || points.length !== 4) {
        points = quadFromMinAreaRect(cv, cnt);
      }
      if (!points || points.length !== 4) continue;

      if (mode === "largest") {
        const scored = scoreQuad(points, imageArea);
        if (!scored.ok) continue;
        if (!bestLargest || scored.area > bestLargest.area) {
          bestLargest = { points, area: scored.area };
        }
      } else {
        const score = scoreSymbolQuad(
          points,
          imageArea,
          gray.cols,
          gray.rows,
          gray,
        );
        if (score < 0) continue;
        if (!bestSymbol || score > bestSymbol.score) {
          bestSymbol = { points, score };
        }
      }
    }

    const picked =
      mode === "symbol" ? bestSymbol?.points : bestLargest?.points;
    if (!picked) return null;
    return orderQuadPoints(picked);
  } catch {
    return null;
  } finally {
    safeDelete(binary);
    safeDelete(closed);
    safeDelete(kernel);
    try {
      contours.delete();
    } catch {
      // ignore
    }
    safeDelete(hierarchy);
  }
}

/**
 * Find the best square-ish 4-point contour inside a grayscale crop and
 * perspective-warp it to a flat square (straightens tilt / mild cylinder warp).
 *
 * Returns null when no suitable quad is found.
 */
export function straightenBarcodeGray(
  cvRuntime: OpenCvRuntime,
  gray: CvMat,
  outputSize = 240,
): { warped: CvMat; quad: [CvPoint, CvPoint, CvPoint, CvPoint] } | null {
  const cv = cvRuntime as CvStraighten;
  if (typeof cv.findContours !== "function") return null;

  const ordered = findBestQuad(cv, gray, "largest");
  if (!ordered) return null;
  const side = Math.max(outputSize, 160);
  const warped = warpQuadToSquare(cv, gray, ordered, side);
  if (!warped) return null;
  return { warped, quad: ordered };
}

/**
 * Lock onto the DataMatrix *symbol* (L-finder / module block), not the outer
 * padded crop box, then perspective-warp that quad to a square.
 *
 * Use this before cylinder dewarp so unrolling acts on the barcode itself.
 */
export function rectifyDataMatrixSymbol(
  cvRuntime: OpenCvRuntime,
  gray: CvMat,
  outputSize = 240,
): { warped: CvMat; quad: [CvPoint, CvPoint, CvPoint, CvPoint] } | null {
  const cv = cvRuntime as CvStraighten;
  if (typeof cv.findContours !== "function") return null;

  const ordered = findBestQuad(cv, gray, "symbol");
  if (!ordered) return null;
  const side = Math.max(outputSize, 160);
  const warped = warpQuadToSquare(cv, gray, ordered, side);
  if (!warped) return null;
  return { warped, quad: ordered };
}

export type { CvPoint };
