import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "../processing/canvas.js";
import { decodeWithFallbacks } from "../processing/decodePipeline.js";
import { remapResultToSource } from "./coordinates.js";
import type { Region } from "./types.js";

export interface RegionScanOptions {
  /** Run multi-scale / enhance fallbacks on the crop. Default false. */
  regionFallbacks?: boolean;
  multiScale?: boolean;
  imageEnhancement?: boolean;
  rotationRetry?: boolean;
  tryHarder?: boolean;
  /**
   * Run the OpenCV.js + zxing-wasm recovery cascade before legacy fallbacks.
   * Intended for YOLO/localized ROI crops. Default false.
   */
  opencvCascade?: boolean;
  /** Formats forwarded to the cascade (DataMatrix preferred when enabled). */
  formats?: readonly BarcodeFormat[];
  /** Staged opencv.js URL for the cascade loader. */
  openCvScriptUrl?: string;
}

export interface RegionScanResult {
  results: BarcodeResult[];
  /** OpenCV diagnostic preview (success or miss) for UI thumbs. */
  cascadePreviewDataUrl?: string;
}

/**
 * Decode a crop of the source canvas and remap geometry to source coordinates.
 * Uses engine-native multi-symbol decode when available.
 */
export async function scanRegion(
  decoder: DecoderAdapter,
  sourceCanvas: HTMLCanvasElement,
  region: Region,
  options: RegionScanOptions = {},
): Promise<RegionScanResult> {
  const doc = sourceCanvas.ownerDocument ?? document;
  const tile = doc.createElement("canvas");
  tile.width = Math.max(1, Math.floor(region.width));
  tile.height = Math.max(1, Math.floor(region.height));

  const ctx = get2dContext(tile);
  ctx.drawImage(
    sourceCanvas,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    tile.width,
    tile.height,
  );

  try {
    let decoded: BarcodeResult[] = [];
    let cascadePreviewDataUrl: string | undefined;

    if (options.opencvCascade) {
      // Dynamic import keeps OpenCV out of the default decode graph until a
      // localized ROI actually requests the cascade.
      const { decodeBarcodeWithCascade } = await import(
        "../processing/opencvCascade.js"
      );
      const outcome = await decodeBarcodeWithCascade(tile, {
        formats: options.formats,
        openCvScriptUrl: options.openCvScriptUrl,
      });
      cascadePreviewDataUrl = outcome.previewDataUrl;
      if (outcome.hit) {
        const remapped = remapResultToSource(outcome.hit.result, region);
        // Prefer the OpenCV enhancement frame ZXing decoded over a raw crop.
        if (outcome.hit.enhancedDataUrl) {
          remapped.cropDataUrl = outcome.hit.enhancedDataUrl;
        }
        return {
          results: [remapped],
          cascadePreviewDataUrl:
            outcome.hit.enhancedDataUrl ?? cascadePreviewDataUrl,
        };
      }
    }

    if (decoder.decodeAll && !options.regionFallbacks) {
      decoded = await decoder.decodeAll({
        canvas: tile,
        sourceWidth: region.width,
        sourceHeight: region.height,
      });
    } else if (options.regionFallbacks) {
      // Fallbacks are single-hit; prefer decodeAll first, then ladder.
      if (decoder.decodeAll) {
        decoded = await decoder.decodeAll({
          canvas: tile,
          sourceWidth: region.width,
          sourceHeight: region.height,
        });
      }
      if (decoded.length === 0) {
        const single = await decodeWithFallbacks(decoder, tile, {
          tryDirect: true,
          multiScale: options.multiScale ?? true,
          imageEnhancement: options.imageEnhancement ?? true,
          rotationRetry: options.rotationRetry ?? false,
          forceTryHarderOnFallback: true,
          restoreTryHarder: options.tryHarder ?? true,
        });
        if (single) decoded = [single];
      }
    } else {
      const single = await decoder.decode({
        canvas: tile,
        sourceWidth: region.width,
        sourceHeight: region.height,
      });
      if (single) decoded = [single];
    }

    return {
      results: decoded.map((item) => remapResultToSource(item, region)),
      cascadePreviewDataUrl,
    };
  } finally {
    tile.width = 0;
    tile.height = 0;
  }
}
