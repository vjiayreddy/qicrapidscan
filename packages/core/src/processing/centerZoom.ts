import type { BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "./canvas.js";

export interface CenterZoomOptions {
  /**
   * Fraction of the source canvas to keep, centered (0.25–1).
   * Default 0.55 — matches barcodesdk live zoom pass.
   */
  cropRatio?: number;
  /**
   * Upscale factor applied after the crop (≥ 1). Default 2.
   */
  scale?: number;
}

export interface CenterZoomGeometry {
  originX: number;
  originY: number;
  cropWidth: number;
  cropHeight: number;
  outWidth: number;
  outHeight: number;
  scale: number;
}

export interface CenterZoomCanvas extends Omit<
  CenterZoomGeometry,
  "outWidth" | "outHeight"
> {
  canvas: HTMLCanvasElement;
  cleanup: () => void;
}

/** Pure crop/upscale geometry for the live zoom pass. */
export function computeCenterZoomGeometry(
  sourceWidth: number,
  sourceHeight: number,
  options: CenterZoomOptions = {},
): CenterZoomGeometry {
  const cropRatio = clamp(options.cropRatio ?? 0.55, 0.25, 1);
  const scale = Math.max(1, options.scale ?? 2);

  const cropWidth = Math.max(1, Math.floor(sourceWidth * cropRatio));
  const cropHeight = Math.max(1, Math.floor(sourceHeight * cropRatio));
  const originX = Math.floor((sourceWidth - cropWidth) / 2);
  const originY = Math.floor((sourceHeight - cropHeight) / 2);
  const outWidth = Math.max(1, Math.round(cropWidth * scale));
  const outHeight = Math.max(1, Math.round(cropHeight * scale));

  return {
    originX,
    originY,
    cropWidth,
    cropHeight,
    outWidth,
    outHeight,
    scale,
  };
}

/**
 * Center-crop a processing canvas and nearest-neighbor upscale it so far/small
 * symbols occupy enough modules for ZXing.
 */
export function createCenterZoomCanvas(
  source: HTMLCanvasElement,
  options: CenterZoomOptions = {},
): CenterZoomCanvas {
  const geometry = computeCenterZoomGeometry(source.width, source.height, options);

  const canvas = document.createElement("canvas");
  canvas.width = geometry.outWidth;
  canvas.height = geometry.outHeight;
  const ctx = get2dContext(canvas);
  // Keep barcode modules crisp — bilinear softens thin bars.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    source,
    geometry.originX,
    geometry.originY,
    geometry.cropWidth,
    geometry.cropHeight,
    0,
    0,
    geometry.outWidth,
    geometry.outHeight,
  );

  return {
    canvas,
    originX: geometry.originX,
    originY: geometry.originY,
    cropWidth: geometry.cropWidth,
    cropHeight: geometry.cropHeight,
    scale: geometry.scale,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Map decode geometry from zoom-canvas space back into the source canvas. */
export function mapResultsFromCenterZoom(
  results: BarcodeResult[],
  zoom: Pick<CenterZoomCanvas, "originX" | "originY" | "scale">,
): BarcodeResult[] {
  const { originX, originY, scale } = zoom;
  if (scale === 1 && originX === 0 && originY === 0) {
    return results;
  }

  const mapPoint = (point: { x: number; y: number }) => ({
    x: point.x / scale + originX,
    y: point.y / scale + originY,
  });

  return results.map((result) => ({
    ...result,
    points: result.points?.map(mapPoint),
    boundingBox: result.boundingBox
      ? {
          x: result.boundingBox.x / scale + originX,
          y: result.boundingBox.y / scale + originY,
          width: result.boundingBox.width / scale,
          height: result.boundingBox.height / scale,
        }
      : undefined,
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
