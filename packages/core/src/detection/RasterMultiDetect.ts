import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { remapResultToSource } from "./coordinates.js";
import {
  createOverlappingTiles,
  exclusionFromResultBox,
  regionMostlyExcluded,
  subdivideRegion,
} from "./ImageTiler.js";
import { ResultAggregator } from "./ResultAggregator.js";
import type { MultiDetectLimits, MultiDetectStats, Region } from "./types.js";

export interface RgbaRaster {
  width: number;
  height: number;
  /** RGBA buffer length = width * height * 4 */
  data: Uint8ClampedArray;
}

function cropRaster(source: RgbaRaster, region: Region): RgbaRaster {
  const width = Math.max(1, Math.floor(region.width));
  const height = Math.max(1, Math.floor(region.height));
  const data = new Uint8ClampedArray(width * height * 4);
  const sx = Math.max(0, Math.floor(region.x));
  const sy = Math.max(0, Math.floor(region.y));

  for (let row = 0; row < height; row += 1) {
    const srcY = sy + row;
    if (srcY >= source.height) break;
    for (let col = 0; col < width; col += 1) {
      const srcX = sx + col;
      if (srcX >= source.width) break;
      const srcIndex = (srcY * source.width + srcX) * 4;
      const dstIndex = (row * width + col) * 4;
      data[dstIndex] = source.data[srcIndex] ?? 0;
      data[dstIndex + 1] = source.data[srcIndex + 1] ?? 0;
      data[dstIndex + 2] = source.data[srcIndex + 2] ?? 0;
      data[dstIndex + 3] = source.data[srcIndex + 3] ?? 255;
    }
  }

  return { width, height, data };
}

async function scanRasterRegion(
  decoder: DecoderAdapter,
  source: RgbaRaster,
  region: Region,
): Promise<BarcodeResult | null> {
  if (!decoder.decodeRaster) {
    throw new Error("Decoder does not implement decodeRaster()");
  }
  const crop = cropRaster(source, region);
  const decoded = await decoder.decodeRaster({
    data: crop.data,
    width: crop.width,
    height: crop.height,
    sourceWidth: region.width,
    sourceHeight: region.height,
  });
  if (!decoded) return null;
  return remapResultToSource(decoded, region);
}

export interface RasterMultiDetectOutcome {
  results: BarcodeResult[];
  stats: MultiDetectStats;
}

/** Node/browser-agnostic multi-detect over an RGBA buffer (for fixtures/benchmarks). */
export async function detectMultipleFromRaster(
  decoder: DecoderAdapter,
  source: RgbaRaster,
  limits: MultiDetectLimits,
): Promise<RasterMultiDetectOutcome> {
  const started = Date.now();
  const aggregator = new ResultAggregator();
  const exclusions: Array<{ x: number; y: number; width: number; height: number }> = [];
  let regionsScanned = 0;
  let stoppedReason: MultiDetectStats["stoppedReason"] = "complete";

  const queue: Region[] = [
    { x: 0, y: 0, width: source.width, height: source.height, depth: 0 },
  ];
  queue.push(
    ...createOverlappingTiles({
      sourceWidth: source.width,
      sourceHeight: source.height,
      maxTiles: Math.max(0, limits.maxRegions - 1),
      overlap: limits.overlap,
      depth: 1,
    }),
  );

  const seen = new Set<string>();

  while (queue.length > 0) {
    if (Date.now() - started >= limits.maxTimeMs) {
      stoppedReason = "maxTime";
      break;
    }
    if (regionsScanned >= limits.maxRegions) {
      stoppedReason = "maxRegions";
      break;
    }

    const region = queue.shift()!;
    const key = `${region.x}:${region.y}:${region.width}:${region.height}:${region.depth}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (regionMostlyExcluded(region, exclusions)) continue;

    regionsScanned += 1;
    const decoded = await scanRasterRegion(decoder, source, region);
    if (decoded) {
      aggregator.add(decoded);
      if (decoded.boundingBox) {
        exclusions.push(exclusionFromResultBox(decoded.boundingBox));
      }
      if (aggregator.finalize(limits.maxResults).length >= limits.maxResults) {
        stoppedReason = "maxResults";
        break;
      }
    }

    // Always explore children while budget remains: a null decode often means
    // multiple codes confused the single-result engine inside this region.
    if (region.depth < limits.maxDepth) {
      for (const child of subdivideRegion(region, source.width, source.height)) {
        if (regionsScanned + queue.length >= limits.maxRegions) break;
        if (regionMostlyExcluded(child, exclusions)) continue;
        queue.push(child);
      }
    }
  }

  const before = aggregator.rawCount();
  const results = aggregator.finalize(limits.maxResults);
  return {
    results,
    stats: {
      regionsScanned,
      resultsBeforeDedupe: before,
      resultsAfterDedupe: results.length,
      elapsedMs: Date.now() - started,
      stoppedReason,
    },
  };
}
