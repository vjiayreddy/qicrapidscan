import type { BarcodeResult } from "../types/barcode.types.js";
import type { Region } from "./types.js";

/** Map a region-local result into the original image coordinate system. */
export function remapResultToSource(result: BarcodeResult, region: Region): BarcodeResult {
  const points = result.points?.map((point) => ({
    x: point.x + region.x,
    y: point.y + region.y,
  }));

  let boundingBox = result.boundingBox;
  if (boundingBox) {
    boundingBox = {
      x: boundingBox.x + region.x,
      y: boundingBox.y + region.y,
      width: boundingBox.width,
      height: boundingBox.height,
    };
  }

  return {
    ...result,
    points,
    boundingBox,
  };
}

export function clampRegion(
  region: Region,
  sourceWidth: number,
  sourceHeight: number,
): Region | null {
  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const right = Math.min(sourceWidth, Math.ceil(region.x + region.width));
  const bottom = Math.min(sourceHeight, Math.ceil(region.y + region.height));
  const width = right - x;
  const height = bottom - y;
  if (width < 8 || height < 8) return null;
  return { x, y, width, height, depth: region.depth };
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  iouThreshold = 0.3,
): boolean {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter <= 0) return false;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 && inter / union >= iouThreshold;
}
