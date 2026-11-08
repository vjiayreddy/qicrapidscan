import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
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
): Promise<BarcodeResult[]> {
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

    return decoded.map((item) => remapResultToSource(item, region));
  } finally {
    tile.width = 0;
    tile.height = 0;
  }
}
