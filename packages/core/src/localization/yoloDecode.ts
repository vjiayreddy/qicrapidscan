import { mapBoxToSource, type LetterboxMeta } from "./letterbox.js";
import type { LocalizationRoi } from "./types.js";

export interface YoloCandidate {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
}

/**
 * Decode Ultralytics YOLO detect export `output0` shaped `[1, 4+nc, N]`
 * (channels-first). For the DataMatrix model: `[1, 5, 33600]` — xywh + 1 score.
 */
export function decodeYoloOutput(
  data: Float32Array,
  dims: readonly number[],
  scoreThreshold: number,
): YoloCandidate[] {
  // Accept [1, C, N] or [C, N]
  let channels: number;
  let numPreds: number;
  if (dims.length === 3) {
    channels = dims[1]!;
    numPreds = dims[2]!;
  } else if (dims.length === 2) {
    channels = dims[0]!;
    numPreds = dims[1]!;
  } else {
    throw new Error(
      `Unexpected YOLO output dims [${dims.join(", ")}]; expected [1,C,N] or [C,N].`,
    );
  }

  if (channels < 5) {
    throw new Error(`YOLO output needs ≥5 channels (got ${channels}).`);
  }

  const candidates: YoloCandidate[] = [];
  for (let i = 0; i < numPreds; i += 1) {
    // Single-class model: score is channel 4. Multi-class: max of class channels.
    let score = 0;
    for (let c = 4; c < channels; c += 1) {
      const v = data[c * numPreds + i]!;
      if (v > score) score = v;
    }
    if (score < scoreThreshold) continue;

    const cx = data[0 * numPreds + i]!;
    const cy = data[1 * numPreds + i]!;
    const w = data[2 * numPreds + i]!;
    const h = data[3 * numPreds + i]!;
    candidates.push({
      x1: cx - w / 2,
      y1: cy - h / 2,
      x2: cx + w / 2,
      y2: cy + h / 2,
      score,
    });
  }

  return candidates;
}

function iou(a: YoloCandidate, b: YoloCandidate): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const inter = w * h;
  if (inter <= 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

/** Class-agnostic greedy NMS, score-descending. */
export function nms(
  candidates: YoloCandidate[],
  iouThreshold: number,
  maxRois: number,
): YoloCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const kept: YoloCandidate[] = [];
  for (const cand of sorted) {
    if (kept.length >= maxRois) break;
    const overlaps = kept.some((other) => iou(cand, other) >= iouThreshold);
    if (!overlaps) kept.push(cand);
  }
  return kept;
}

export function candidatesToRois(
  candidates: YoloCandidate[],
  meta: LetterboxMeta,
  className: string,
): LocalizationRoi[] {
  return candidates.map((cand) => {
    const box = mapBoxToSource(cand, meta);
    return {
      ...box,
      score: cand.score,
      label: className,
    };
  });
}
