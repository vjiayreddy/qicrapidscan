import { get2dContext } from "./canvas.js";
import { enhanceCropPixels } from "./cropBarcode.js";
import type { OwnedCanvas } from "./decodePipeline.js";
import { enhanceForDecode, resizeCanvas } from "./decodePipeline.js";

export interface PrepareBarcodeDecodeOptions {
  /** Left/right pad already expected on the ROI; used only for docs/defaults. */
  padRatioX?: number;
  /** Pure white border on left/right (and matching top/bottom). Default 30. */
  whiteBorderPx?: number;
  /** Ensure barcode content width ≥ this before the white border. Default 500. */
  minBarcodeWidth?: number;
  /** Upscale factor after grayscale/contrast. Default 2. */
  finalUpscale?: number;
  /** Contrast stretch for the grayscale pass. Default 1.8. */
  contrast?: number;
}

export interface PreparedBarcodeDecode extends OwnedCanvas {
  /**
   * Map a point from the prepared canvas back to the input tile's
   * local coordinates (before white border / min-width / final upscale).
   */
  toTileLocal: (x: number, y: number) => { x: number; y: number };
  /** Aggregate scale from tile → prepared canvas (for geometry). */
  scaleFromTile: number;
  borderPx: number;
}

/**
 * Build a ZXing-friendly canvas from a YOLO/region tile:
 * 1) Upscale so barcode width ≥ minBarcodeWidth (450–600px target)
 * 2) Pad with pure white (#FFFFFF) quiet-zone border (≥30px L/R)
 * 3) Grayscale + contrast stretch
 * 4) 2× upscale + sharpen
 *
 * Caller must invoke `cleanup()`.
 */
export function prepareBarcodeDecodeCanvas(
  tile: HTMLCanvasElement,
  options: PrepareBarcodeDecodeOptions = {},
): PreparedBarcodeDecode | null {
  if (typeof document === "undefined") return null;
  if (tile.width < 2 || tile.height < 2) return null;

  const whiteBorderPx = Math.max(0, options.whiteBorderPx ?? 30);
  const minBarcodeWidth = Math.max(1, options.minBarcodeWidth ?? 500);
  const finalUpscale = Math.max(1, options.finalUpscale ?? 2);
  const contrast = options.contrast ?? 1.8;

  const owned: HTMLCanvasElement[] = [];
  const track = (canvas: HTMLCanvasElement) => {
    owned.push(canvas);
    return canvas;
  };
  const cleanupAll = () => {
    for (const canvas of owned) {
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  try {
    // 1) Min barcode width (full-res feel even if the scan canvas was capped).
    let content = tile;
    let minWidthScale = 1;
    if (tile.width < minBarcodeWidth) {
      minWidthScale = minBarcodeWidth / tile.width;
      const up = resizeCanvas(tile, minWidthScale);
      track(up.canvas);
      content = up.canvas;
    }

    // 2) Pure white quiet-zone canvas (L/R ≥ 30px, matching T/B).
    const bordered = track(document.createElement("canvas"));
    bordered.width = content.width + whiteBorderPx * 2;
    bordered.height = content.height + whiteBorderPx * 2;
    const bctx = get2dContext(bordered);
    bctx.fillStyle = "#FFFFFF";
    bctx.fillRect(0, 0, bordered.width, bordered.height);
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = "high";
    bctx.drawImage(content, whiteBorderPx, whiteBorderPx);

    // 3) Grayscale + contrast stretch (no sharpen yet — sharpen after 2×).
    const normalized = enhanceForDecode(bordered, {
      contrast,
      sharpen: false,
    });
    track(normalized.canvas);

    // 4) Forced 2× upscale + sharpen.
    let finalCanvas = normalized.canvas;
    let finalScale = 1;
    if (finalUpscale > 1.01) {
      const scaled = resizeCanvas(normalized.canvas, finalUpscale);
      track(scaled.canvas);
      // Nearest-neighbor upscale can look blocky — re-draw with high-quality
      // smoothing then sharpen modules for ZXing.
      const smooth = track(document.createElement("canvas"));
      smooth.width = scaled.canvas.width;
      smooth.height = scaled.canvas.height;
      const sctx = get2dContext(smooth);
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(normalized.canvas, 0, 0, smooth.width, smooth.height);
      const imageData = sctx.getImageData(0, 0, smooth.width, smooth.height);
      enhanceCropPixels(imageData.data, { grayscale: false, contrast: 1.15 });
      sharpen3x3(imageData.data, smooth.width, smooth.height);
      sctx.putImageData(imageData, 0, 0);
      finalCanvas = smooth;
      finalScale = finalUpscale;
    } else {
      const sharpened = enhanceForDecode(normalized.canvas, {
        contrast: 1,
        sharpen: true,
      });
      track(sharpened.canvas);
      finalCanvas = sharpened.canvas;
    }

    const scaleFromTile = minWidthScale * finalScale;
    const borderOnFinal = whiteBorderPx * finalScale;

    return {
      canvas: finalCanvas,
      scaleFromTile,
      borderPx: borderOnFinal,
      toTileLocal: (x: number, y: number) => ({
        x: (x - borderOnFinal) / scaleFromTile,
        y: (y - borderOnFinal) / scaleFromTile,
      }),
      cleanup: cleanupAll,
    };
  } catch {
    cleanupAll();
    return null;
  }
}

function sharpen3x3(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const copy = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += copy[idx]! * kernel[ki]!;
            ki += 1;
          }
        }
        data[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, sum));
      }
    }
  }
}
