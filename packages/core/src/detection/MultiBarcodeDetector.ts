import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import {
  createOverlappingTiles,
  exclusionFromResultBox,
  regionMostlyExcluded,
  subdivideRegion,
} from "./ImageTiler.js";
import { ResultAggregator } from "./ResultAggregator.js";
import { scanRegion, type RegionScanOptions } from "./RegionScanner.js";
import type { MultiDetectLimits, MultiDetectStats, Region } from "./types.js";

export interface MultiDetectOutcome {
  results: BarcodeResult[];
  stats: MultiDetectStats;
}

/**
 * Best-effort multi-barcode detection around a single/multi-result decoder.
 * Seeds from engine-native decodeAll when available, then tiles to find the rest.
 * Bounded by maxResults / maxRegions / maxDepth / maxTimeMs.
 */
export class MultiBarcodeDetector {
  constructor(
    private readonly decoder: DecoderAdapter,
    private readonly limits: MultiDetectLimits,
    private readonly regionOptions: RegionScanOptions = {},
  ) {}

  async detect(sourceCanvas: HTMLCanvasElement): Promise<MultiDetectOutcome> {
    const started = Date.now();
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    if (sourceWidth < 8 || sourceHeight < 8) {
      return {
        results: [],
        stats: {
          regionsScanned: 0,
          resultsBeforeDedupe: 0,
          resultsAfterDedupe: 0,
          elapsedMs: 0,
          stoppedReason: "complete",
        },
      };
    }

    const aggregator = new ResultAggregator();
    const exclusions: Array<{ x: number; y: number; width: number; height: number }> = [];
    let regionsScanned = 0;
    let stoppedReason: MultiDetectStats["stoppedReason"] = "complete";

    // Native multi-symbol pass — seed only; keep tiling when under maxResults.
    // Dense trays often yield a partial full-frame hit (tiny modules after downscale).
    if (this.decoder.decodeAll) {
      regionsScanned += 1;
      const native = await this.decoder.decodeAll({ canvas: sourceCanvas });
      for (const item of native) {
        aggregator.add(item);
        if (item.boundingBox) {
          exclusions.push(exclusionFromResultBox(item.boundingBox));
        }
      }
      if (aggregator.finalize(this.limits.maxResults).length >= this.limits.maxResults) {
        const results = aggregator.finalize(this.limits.maxResults);
        return {
          results,
          stats: {
            regionsScanned,
            resultsBeforeDedupe: aggregator.rawCount(),
            resultsAfterDedupe: results.length,
            elapsedMs: Date.now() - started,
            stoppedReason: "maxResults",
          },
        };
      }
    }

    const queue: Region[] = [];
    // Skip full-frame tile when decodeAll already ran — go straight to overlapping tiles.
    if (!this.decoder.decodeAll) {
      queue.push({ x: 0, y: 0, width: sourceWidth, height: sourceHeight, depth: 0 });
    }

    const remainingForTiles = Math.max(0, this.limits.maxRegions - regionsScanned);
    queue.push(
      ...createOverlappingTiles({
        sourceWidth,
        sourceHeight,
        maxTiles: remainingForTiles,
        overlap: this.limits.overlap,
        depth: 1,
      }),
    );

    const seenRegionKeys = new Set<string>();

    while (queue.length > 0) {
      if (Date.now() - started >= this.limits.maxTimeMs) {
        stoppedReason = "maxTime";
        break;
      }
      if (regionsScanned >= this.limits.maxRegions) {
        stoppedReason = "maxRegions";
        break;
      }

      const region = queue.shift()!;
      const key = `${region.x}:${region.y}:${region.width}:${region.height}:${region.depth}`;
      if (seenRegionKeys.has(key)) continue;
      seenRegionKeys.add(key);

      if (regionMostlyExcluded(region, exclusions)) {
        continue;
      }

      regionsScanned += 1;
      const { results: decoded } = await scanRegion(
        this.decoder,
        sourceCanvas,
        region,
        this.regionOptions,
      );
      for (const item of decoded) {
        aggregator.add(item);
        if (item.boundingBox) {
          exclusions.push(exclusionFromResultBox(item.boundingBox));
        }
      }

      if (aggregator.finalize(this.limits.maxResults).length >= this.limits.maxResults) {
        stoppedReason = "maxResults";
        break;
      }

      if (region.depth < this.limits.maxDepth) {
        for (const child of subdivideRegion(region, sourceWidth, sourceHeight)) {
          if (regionsScanned + queue.length >= this.limits.maxRegions) break;
          if (regionMostlyExcluded(child, exclusions)) continue;
          queue.push(child);
        }
      }
    }

    const before = aggregator.rawCount();
    const results = aggregator.finalize(this.limits.maxResults);
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
}
