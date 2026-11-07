import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "../processing/canvas.js";
import { remapResultToSource } from "./coordinates.js";
import type { Region } from "./types.js";

/**
 * Decode a crop of the source canvas and remap geometry to source coordinates.
 */
export function scanRegion(
  decoder: DecoderAdapter,
  sourceCanvas: HTMLCanvasElement,
  region: Region,
): BarcodeResult | null {
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
    const decoded = decoder.decode({
      canvas: tile,
      sourceWidth: region.width,
      sourceHeight: region.height,
    });
    if (!decoded) return null;
    return remapResultToSource(decoded, region);
  } finally {
    tile.width = 0;
    tile.height = 0;
  }
}
