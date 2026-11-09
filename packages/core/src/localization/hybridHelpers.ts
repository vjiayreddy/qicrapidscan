import type { LocalizationRoi } from "./types.js";

/** Attach crop decode outcome onto a localization ROI. */
export function withRoiDecodeStatus(
  roi: LocalizationRoi,
  results: Array<{ text: string; format: string }>,
): LocalizationRoi {
  const texts = results.map((r) => r.text).filter(Boolean);
  const formats = results.map((r) => r.format);
  return {
    ...roi,
    decoded: texts.length > 0,
    texts,
    formats,
  };
}

export function pointInRoi(
  x: number,
  y: number,
  roi: { x: number; y: number; width: number; height: number },
  pad = 0,
): boolean {
  return (
    x >= roi.x - pad &&
    y >= roi.y - pad &&
    x <= roi.x + roi.width + pad &&
    y <= roi.y + roi.height + pad
  );
}

function roiArea(roi: { width: number; height: number }): number {
  return Math.max(1, roi.width * roi.height);
}

function roiIou(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  if (inter <= 0) return 0;
  return inter / (roiArea(a) + roiArea(b) - inter);
}

function roiCenter(roi: { x: number; y: number; width: number; height: number }) {
  return { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 };
}

/** Prefer the smallest ROI that contains the barcode centroid. */
export function findContainingRoiIndex(
  point: { x: number; y: number },
  rois: Array<{ x: number; y: number; width: number; height: number }>,
): number {
  let best = -1;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rois.length; i += 1) {
    const roi = rois[i]!;
    if (
      !pointInRoi(
        point.x,
        point.y,
        roi,
        Math.max(roi.width, roi.height) * 0.05,
      )
    ) {
      continue;
    }
    const area = roiArea(roi);
    if (area < bestArea) {
      bestArea = area;
      best = i;
    }
  }
  return best;
}

/**
 * Drop duplicate / nested localizer boxes so the UI doesn't show double marks.
 */
export function dedupeLocalizationRois(
  rois: LocalizationRoi[],
  iouThreshold = 0.45,
): LocalizationRoi[] {
  if (rois.length <= 1) return rois;

  const byPayload = new Map<string, LocalizationRoi>();
  const withoutText: LocalizationRoi[] = [];
  for (const roi of rois) {
    const text = roi.decoded && roi.texts?.[0] ? roi.texts[0] : "";
    if (!text) {
      withoutText.push(roi);
      continue;
    }
    const prev = byPayload.get(text);
    if (!prev) {
      byPayload.set(text, roi);
      continue;
    }
    const prevScore = prev.score ?? 0;
    const nextScore = roi.score ?? 0;
    if (
      nextScore > prevScore ||
      (nextScore === prevScore && roiArea(roi) < roiArea(prev))
    ) {
      byPayload.set(text, roi);
    }
  }

  const candidates = [...byPayload.values(), ...withoutText];
  const sorted = [...candidates].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || roiArea(a) - roiArea(b),
  );
  const kept: LocalizationRoi[] = [];
  for (const roi of sorted) {
    const overlaps = kept.some((other) => roiIou(roi, other) >= iouThreshold);
    if (!overlaps) kept.push(roi);
  }

  return kept.filter((roi) => {
    const area = roiArea(roi);
    return !kept.some((other) => {
      if (other === roi) return false;
      if (roiArea(other) * 2.2 >= area) return false;
      const child = roiCenter(other);
      return pointInRoi(child.x, child.y, roi, 0);
    });
  });
}

/** Axis-aligned crop rect with relative padding, clamped to the source. */
export function paddedRoiRect(
  roi: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number,
  padRatio: number,
): { x: number; y: number; width: number; height: number } {
  const padX = roi.width * padRatio;
  const padY = roi.height * padRatio;
  let x1 = Math.floor(roi.x - padX);
  let y1 = Math.floor(roi.y - padY);
  let x2 = Math.ceil(roi.x + roi.width + padX);
  let y2 = Math.ceil(roi.y + roi.height + padY);

  x1 = Math.max(0, Math.min(sourceWidth - 1, x1));
  y1 = Math.max(0, Math.min(sourceHeight - 1, y1));
  x2 = Math.max(x1 + 1, Math.min(sourceWidth, x2));
  y2 = Math.max(y1 + 1, Math.min(sourceHeight, y2));

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}
