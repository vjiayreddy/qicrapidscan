import type { BarcodeResult } from "../types/barcode.types.js";
import { boundingBoxFromPoints, toCornerPoints } from "../detection/geometry.js";
import { get2dContext } from "./canvas.js";

export type CropSource =
  | HTMLVideoElement
  | HTMLCanvasElement
  | HTMLImageElement;

export interface CropBarcodeOptions {
  /** Extra padding around the barcode as a fraction of box size. Default 0.06. */
  paddingRatio?: number;
  /** Output JPEG quality 0–1. Default 0.84. */
  quality?: number;
  /** Max edge length of the square thumbnail. Default 160. */
  maxEdge?: number;
  /** Force a square crop centered on the barcode. Default true. */
  square?: boolean;
  /** Convert the crop to grayscale. Default true. */
  grayscale?: boolean;
  /**
   * Contrast boost after grayscale (1 = none). Default 1.4.
   * Values above 1 push dark/light modules apart for a decode-style look.
   */
  contrast?: number;
  /**
   * Soften module edges slightly (Scanbot-style filtered patch). Default true.
   */
  soften?: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
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
 * Build a (optionally square) crop rect around a barcode box, clamped to the
 * source frame. Tight padding keeps the thumb focused on the symbol.
 */
export function computeCropRect(
  box: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number,
  paddingRatio = 0.06,
  square = true,
): CropRect {
  const padX = box.width * paddingRatio;
  const padY = box.height * paddingRatio;
  let width = Math.max(1, box.width + padX * 2);
  let height = Math.max(1, box.height + padY * 2);

  if (square) {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }

  // Shrink if the square would exceed the frame.
  width = Math.min(width, sourceWidth);
  height = Math.min(height, sourceHeight);

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  let x = Math.floor(centerX - width / 2);
  let y = Math.floor(centerY - height / 2);

  x = Math.max(0, Math.min(x, sourceWidth - width));
  y = Math.max(0, Math.min(y, sourceHeight - height));

  return {
    x,
    y,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function contrastChannel(value: number, contrast: number): number {
  if (contrast === 1) return value;
  return Math.min(255, Math.max(0, Math.round((value - 128) * contrast + 128)));
}

/** Perceptual luma grayscale and/or mid-point contrast (in place). */
export function enhanceCropPixels(
  data: Uint8ClampedArray,
  options: { grayscale?: boolean; contrast?: number } = {},
): void {
  const grayscale = options.grayscale ?? true;
  const contrast = options.contrast ?? 1.4;

  for (let i = 0; i < data.length; i += 4) {
    if (grayscale) {
      const y = contrastChannel(
        (data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114) | 0,
        contrast,
      );
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
      continue;
    }

    data[i] = contrastChannel(data[i]!, contrast);
    data[i + 1] = contrastChannel(data[i + 1]!, contrast);
    data[i + 2] = contrastChannel(data[i + 2]!, contrast);
  }
}

/** Tiny 3×3 box blur for a soft filtered look (in place, RGBA). */
export function softenCropPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 3 || height < 3) return;

  const copy = new Uint8ClampedArray(data);
  const idx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          sum += copy[idx(x + dx, y + dy)]!;
        }
      }
      const v = (sum / 9) | 0;
      const i = idx(x, y);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
}

/**
 * Crop a barcode thumbnail from a video/image/canvas using result geometry.
 * Defaults to a tight square grayscale/contrast patch (Scanbot-style history thumb).
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

  const paddingRatio = options.paddingRatio ?? 0.06;
  const square = options.square ?? true;
  const crop = computeCropRect(
    box,
    sourceWidth,
    sourceHeight,
    paddingRatio,
    square,
  );

  const maxEdge = options.maxEdge ?? 160;
  const scale = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  const outW = Math.max(1, Math.round(crop.width * scale));
  const outH = Math.max(1, Math.round(crop.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(
    source as CanvasImageSource,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );

  const grayscale = options.grayscale ?? true;
  const contrast = options.contrast ?? 1.4;
  const soften = options.soften ?? true;

  if (grayscale || contrast !== 1 || soften) {
    const imageData = ctx.getImageData(0, 0, outW, outH);
    // Grayscale first, soften modules, then punch contrast (Scanbot-style patch).
    if (grayscale) {
      enhanceCropPixels(imageData.data, { grayscale: true, contrast: 1 });
    }
    if (soften) {
      softenCropPixels(imageData.data, outW, outH);
    }
    if (contrast !== 1) {
      enhanceCropPixels(imageData.data, {
        grayscale: false,
        contrast,
      });
    }
    ctx.putImageData(imageData, 0, 0);
  }

  try {
    return canvas.toDataURL("image/jpeg", options.quality ?? 0.84);
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
