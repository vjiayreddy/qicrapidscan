import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import {
  createOverlappingTiles,
  exclusionFromResultBox,
  regionMostlyExcluded,
  subdivideRegion,
} from "./ImageTiler.js";
import { ResultAggregator } from "./ResultAggregator.js";
import { scanRegion } from "./RegionScanner.js";
import type { MultiDetectLimits, MultiDetectStats, Region } from "./types.js";

export interface MultiDetectOutcome {
  results: BarcodeResult[];
  stats: MultiDetectStats;
}

/**
 * Best-effort multi-barcode detection around a single-result decoder.
 * Bounded by maxResults / maxRegions / maxDepth / maxTimeMs.
 */
export class MultiBarcodeDetector {
  constructor(
    private readonly decoder: DecoderAdapter,
    private readonly limits: MultiDetectLimits,
  ) {}

  detect(sourceCanvas: HTMLCanvasElement): MultiDetectOutcome {
    const started = Date.now();
    const aggregator = new ResultAggregator();
    const exclusions: Array<{ x: number; y: number; width: number; height: number }> = [];
    let regionsScanned = 0;
    let stoppedReason: MultiDetectStats["stoppedReason"] = "complete";

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

    const queue: Region[] = [
      { x: 0, y: 0, width: sourceWidth, height: sourceHeight, depth: 0 },
    ];

    // Seed overlapping tiles after the full frame (depth 1).
    const remainingForTiles = Math.max(0, this.limits.maxRegions - 1);
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
      const decoded = scanRegion(this.decoder, sourceCanvas, region);
      if (decoded) {
        aggregator.add(decoded);
        if (decoded.boundingBox) {
          exclusions.push(exclusionFromResultBox(decoded.boundingBox));
        }

        const finalizedEarly = aggregator.finalize(this.limits.maxResults);
        if (finalizedEarly.length >= this.limits.maxResults) {
          stoppedReason = "maxResults";
          break;
        }
      }

      // Subdivide large misses/hits: multiple codes in one region often yield null.
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
