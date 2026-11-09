import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "../processing/canvas.js";
import {
  decodeWithFallbacks,
  enhanceForDecode,
  resizeCanvas,
} from "../processing/decodePipeline.js";
import { decodeCanvasWithZxing } from "../processing/zxingFormats.js";
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
   * Run the OpenCV.js + zxing-wasm recovery cascade after raw decode misses.
   * Intended for hard bottle DataMatrix ROIs. Default false.
   */
  opencvCascade?: boolean;
  /** Formats forwarded to the cascade / region decoder. */
  formats?: readonly BarcodeFormat[];
  /** Staged opencv.js URL for the cascade loader. */
  openCvScriptUrl?: string;
}

export interface RegionScanResult {
  results: BarcodeResult[];
  /** OpenCV diagnostic preview (success or miss) for UI thumbs. */
  cascadePreviewDataUrl?: string;
  /** JPEG of the raw YOLO crop (before cascade) for failed-thumb UI. */
  rawCropDataUrl?: string;
}

function tileToJpegDataUrl(tile: HTMLCanvasElement): string | undefined {
  if (typeof document === "undefined") return undefined;
  if (tile.width < 2 || tile.height < 2) return undefined;
  try {
    const maxEdge = 256;
    const scale = Math.min(1, maxEdge / Math.max(tile.width, tile.height));
    if (scale >= 0.999) {
      return tile.toDataURL("image/jpeg", 0.9);
    }
    const w = Math.max(1, Math.round(tile.width * scale));
    const h = Math.max(1, Math.round(tile.height * scale));
    const thumb = document.createElement("canvas");
    thumb.width = w;
    thumb.height = h;
    const ctx = thumb.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tile, 0, 0, w, h);
    const url = thumb.toDataURL("image/jpeg", 0.9);
    thumb.width = 0;
    thumb.height = 0;
    return url;
  } catch {
    return undefined;
  }
}

/** Upscale thin linear crops so Code128 bars span enough pixels for ZXing. */
function prepareLinearTile(tile: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  cleanup: () => void;
  scale: number;
} {
  const short = Math.min(tile.width, tile.height);
  const long = Math.max(tile.width, tile.height);
  const scaleShort = short > 0 && short < 140 ? 140 / short : 1;
  const scaleLong = long > 0 && long < 320 ? 320 / long : 1;
  const scale = Math.min(5, Math.max(scaleShort, scaleLong, 1));
  if (scale <= 1.01) {
    return { canvas: tile, cleanup: () => undefined, scale: 1 };
  }
  const resized = resizeCanvas(tile, scale);
  return { canvas: resized.canvas, cleanup: resized.cleanup, scale };
}

/**
 * Decode a crop of the source canvas and remap geometry to source coordinates.
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

  const rawCropDataUrl = tileToJpegDataUrl(tile);

  const restoreFormats =
    options.formats &&
    options.formats.length > 0 &&
    typeof decoder.getFormats === "function"
      ? [...decoder.getFormats()]
      : null;
  if (options.formats && options.formats.length > 0) {
    decoder.setFormats([...options.formats]);
  }

  const linearPrep = prepareLinearTile(tile);

  try {
    let decoded: BarcodeResult[] = [];
    let fromZxingPrep = false;
    let cascadePreviewDataUrl: string | undefined;

    // 1) Raw / enhanced / upscaled decode FIRST.
    // OpenCV bottle cascade can destroy flat shipping-label symbologies.
    if (decoder.decodeAll) {
      decoded = await decoder.decodeAll({
        canvas: linearPrep.canvas,
        // Map detector coords from prep canvas → original region size.
        sourceWidth: region.width,
        sourceHeight: region.height,
      });
    }
    if (decoded.length === 0 && options.regionFallbacks !== false) {
      const single = await decodeWithFallbacks(decoder, linearPrep.canvas, {
        tryDirect: true,
        multiScale: options.multiScale ?? true,
        imageEnhancement: options.imageEnhancement ?? true,
        rotationRetry: options.rotationRetry ?? true,
        forceTryHarderOnFallback: true,
        restoreTryHarder: options.tryHarder ?? true,
        scales: [1, 1.5, 2, 2.5, 3],
      });
      if (single) {
        // decodeWithFallbacks returns prep-canvas coords — scale to tile size.
        const inv = linearPrep.scale > 0 ? 1 / linearPrep.scale : 1;
        decoded = [
          {
            ...single,
            points: single.points?.map((p) => ({
              x: p.x * inv,
              y: p.y * inv,
            })),
            boundingBox: single.boundingBox
              ? {
                  x: single.boundingBox.x * inv,
                  y: single.boundingBox.y * inv,
                  width: single.boundingBox.width * inv,
                  height: single.boundingBox.height * inv,
                }
              : undefined,
          },
        ];
      }
    } else if (decoded.length === 0) {
      const single = await decoder.decode({
        canvas: linearPrep.canvas,
        sourceWidth: region.width,
        sourceHeight: region.height,
      });
      if (single) decoded = [single];
    }

    if (decoded.length === 0) {
      try {
        decoded = await decodeCanvasWithZxing(
          linearPrep.canvas,
          options.formats,
        );
        fromZxingPrep = decoded.length > 0;
      } catch {
        decoded = [];
      }
    }

    if (decoded.length === 0 && (options.imageEnhancement ?? true)) {
      const enhanced = enhanceForDecode(linearPrep.canvas, {
        contrast: 1.75,
        sharpen: true,
      });
      try {
        decoded = await decodeCanvasWithZxing(enhanced.canvas, options.formats);
        fromZxingPrep = decoded.length > 0;
      } catch {
        decoded = [];
      } finally {
        enhanced.cleanup();
      }
    }

    // 2) OpenCV cascade last — curved bottle DataMatrix recovery.
    if (decoded.length === 0 && options.opencvCascade) {
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
        if (outcome.hit.enhancedDataUrl) {
          remapped.cropDataUrl = outcome.hit.enhancedDataUrl;
        }
        return {
          results: [remapped],
          cascadePreviewDataUrl:
            outcome.hit.enhancedDataUrl ?? cascadePreviewDataUrl,
          rawCropDataUrl,
        };
      }
    }

    const remapped = decoded.map((item) => {
      // ZXing path returns prep-canvas pixels; scale back to tile space first.
      if (fromZxingPrep && linearPrep.scale !== 1) {
        const inv = 1 / linearPrep.scale;
        const scaled: BarcodeResult = {
          ...item,
          points: item.points?.map((p) => ({ x: p.x * inv, y: p.y * inv })),
          boundingBox: item.boundingBox
            ? {
                x: item.boundingBox.x * inv,
                y: item.boundingBox.y * inv,
                width: item.boundingBox.width * inv,
                height: item.boundingBox.height * inv,
              }
            : undefined,
        };
        return remapResultToSource(scaled, region);
      }
      // decodeAll(sourceWidth/Height) already mapped into region-local space.
      return remapResultToSource(item, region);
    });

    return {
      results: remapped,
      cascadePreviewDataUrl,
      rawCropDataUrl,
    };
  } finally {
    linearPrep.cleanup();
    if (restoreFormats && restoreFormats.length > 0) {
      decoder.setFormats(restoreFormats);
    }
    tile.width = 0;
    tile.height = 0;
  }
}
