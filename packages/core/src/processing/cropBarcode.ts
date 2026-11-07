import type { BarcodeResult } from "../types/barcode.types.js";
import { boundingBoxFromPoints, toCornerPoints } from "../detection/geometry.js";
import { get2dContext } from "./canvas.js";

export type CropSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement;

export interface CropBarcodeOptions {
  /** Extra padding around the barcode as a fraction of box size. Default 0.12. */
  paddingRatio?: number;
  /** Output JPEG quality 0–1. Default 0.82. */
  quality?: number;
  /** Max edge length of the thumbnail. Default 240. */
  maxEdge?: number;
}

function sourceSize(source: CropSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return { width: source.width, height: source.height };
}

/**
 * Crop a barcode thumbnail from a video/image/canvas using result geometry.
 * Returns a JPEG data URL, or null when geometry/source is unavailable.
 */
export function cropBarcodeFrame(
  source: CropSource,
  result: BarcodeResult,
  options: CropBarcodeOptions = {},
): string | null {
  if (typeof document === "undefined") return null;

  const { width: sourceWidth, height: sourceHeight } = sourceSize(source);
  if (!sourceWidth || !sourceHeight) return null;

  const corners = toCornerPoints(result);
  const box =
    corners.length >= 2
      ? boundingBoxFromPoints(corners)
      : result.boundingBox;
  if (!box || box.width <= 0 || box.height <= 0) return null;

  const paddingRatio = options.paddingRatio ?? 0.12;
  const padX = box.width * paddingRatio;
  const padY = box.height * paddingRatio;

  const sx = Math.max(0, Math.floor(box.x - padX));
  const sy = Math.max(0, Math.floor(box.y - padY));
  const sx2 = Math.min(sourceWidth, Math.ceil(box.x + box.width + padX));
  const sy2 = Math.min(sourceHeight, Math.ceil(box.y + box.height + padY));
  const sw = Math.max(1, sx2 - sx);
  const sh = Math.max(1, sy2 - sy);

  const maxEdge = options.maxEdge ?? 240;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = get2dContext(canvas);
  ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, outW, outH);

  try {
    return canvas.toDataURL("image/jpeg", options.quality ?? 0.82);
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
