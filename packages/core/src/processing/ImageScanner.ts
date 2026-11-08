import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { ONE_D_FORMATS, TWO_D_FORMATS } from "../decoder/formats.js";
import { MultiBarcodeDetector } from "../detection/MultiBarcodeDetector.js";
import { dedupeResults } from "../detection/Deduplicator.js";
import type { MultiDetectLimits, MultiDetectStats } from "../detection/types.js";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import { BarcodeError } from "../errors/BarcodeError.js";
import {
  drawBlob,
  drawCanvasElement,
  drawImageElement,
  drawVideoFrame,
} from "./canvas.js";
import { decodeWithFallbacks } from "./decodePipeline.js";
import { scaleResultsToSource } from "../detection/geometry.js";

export type ImageSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | Blob;

export interface ImageScannerOptions {
  maxWidth?: number;
  maxHeight?: number;
  multiple?: boolean;
  multiLimits?: MultiDetectLimits;
  multiScale?: boolean;
  rotationRetry?: boolean;
  imageEnhancement?: boolean;
  /** Baseline TRY_HARDER to restore after fallback passes. */
  tryHarder?: boolean;
  /** When true, region crops also run scale/enhance (budget via maxTimeMs). */
  regionFallbacks?: boolean;
  /**
   * Active symbologies for this scan. When both 1D and 2D are present, a
   * dedicated 1D pass runs after the primary multi-detect so linear codes are
   * not starved by dense Data Matrix / QR packs.
   */
  formats?: BarcodeFormat[];
}

export interface ImageScanOutcome {
  results: BarcodeResult[];
  stats?: MultiDetectStats;
}

export class ImageScanner {
  constructor(
    private readonly decoder: DecoderAdapter,
    private options: ImageScannerOptions = {},
  ) {}

  setOptions(options: ImageScannerOptions): void {
    this.options = options;
  }

  async scan(source: ImageSource): Promise<BarcodeResult[]> {
    const outcome = await this.scanWithStats(source);
    return outcome.results;
  }

  async scanWithStats(source: ImageSource): Promise<ImageScanOutcome> {
    const sized = await this.toCanvas(source);
    try {
      if (this.options.multiple && this.options.multiLimits) {
        const primary = await this.runMultiDetect(sized.canvas);
        let results = primary.results;
        let stats = primary.stats;

        // Dense 2D packs fill maxResults before edge 1D codes are tried.
        const oneD = this.enabledOneD();
        const twoD = this.enabledTwoD();
        if (oneD.length > 0 && twoD.length > 0) {
          const previousFormats = this.options.formats?.length
            ? [...this.options.formats]
            : [...oneD, ...twoD];
          this.decoder.setFormats(oneD);
          try {
            const oneDLimits: MultiDetectLimits = {
              ...this.options.multiLimits,
              maxResults: Math.max(this.options.multiLimits.maxResults, 16),
              maxRegions: Math.max(this.options.multiLimits.maxRegions, 20),
              maxTimeMs: Math.max(this.options.multiLimits.maxTimeMs, 800),
            };
            const secondary = await new MultiBarcodeDetector(
              this.decoder,
              oneDLimits,
              {
                // Enable fallbacks so vertical side 1D codes can rotate.
                regionFallbacks: true,
                multiScale: false,
                imageEnhancement: false,
                rotationRetry: this.options.rotationRetry ?? true,
                tryHarder: this.options.tryHarder ?? true,
              },
            ).detect(sized.canvas);

            results = dedupeResults([...results, ...secondary.results]).slice(
              0,
              Math.max(oneDLimits.maxResults, this.options.multiLimits.maxResults),
            );
            stats = {
              ...stats,
              regionsScanned: stats.regionsScanned + secondary.stats.regionsScanned,
              resultsBeforeDedupe:
                stats.resultsBeforeDedupe + secondary.stats.resultsBeforeDedupe,
              resultsAfterDedupe: results.length,
              elapsedMs: stats.elapsedMs + secondary.stats.elapsedMs,
            };
          } finally {
            this.decoder.setFormats(previousFormats);
          }
        }

        if (results.length > 0) {
          return {
            results: scaleResultsToSource(
              results,
              sized.canvas.width,
              sized.canvas.height,
              sized.sourceWidth,
              sized.sourceHeight,
            ),
            stats,
          };
        }

        const fallback = await this.decodeSingleWithFallbacks(sized.canvas);
        return {
          results: fallback
            ? scaleResultsToSource(
                [fallback],
                sized.canvas.width,
                sized.canvas.height,
                sized.sourceWidth,
                sized.sourceHeight,
              )
            : [],
          stats,
        };
      }

      const result = await this.decodeSingleWithFallbacks(sized.canvas);
      return {
        results: result
          ? scaleResultsToSource(
              [result],
              sized.canvas.width,
              sized.canvas.height,
              sized.sourceWidth,
              sized.sourceHeight,
            )
          : [],
      };
    } finally {
      sized.cleanup();
    }
  }

  private async runMultiDetect(canvas: HTMLCanvasElement): Promise<{
    results: BarcodeResult[];
    stats: MultiDetectStats;
  }> {
    const detector = new MultiBarcodeDetector(
      this.decoder,
      this.options.multiLimits!,
      {
        regionFallbacks: this.options.regionFallbacks ?? false,
        multiScale: this.options.multiScale ?? true,
        imageEnhancement: this.options.imageEnhancement ?? true,
        rotationRetry: false,
        tryHarder: this.options.tryHarder ?? true,
      },
    );
    return detector.detect(canvas);
  }

  private enabledOneD(): BarcodeFormat[] {
    const formats = this.options.formats ?? [];
    const allowed = new Set<string>(ONE_D_FORMATS);
    return formats.filter((f) => allowed.has(f));
  }

  private enabledTwoD(): BarcodeFormat[] {
    const formats = this.options.formats ?? [];
    const allowed = new Set<string>(TWO_D_FORMATS);
    return formats.filter((f) => allowed.has(f));
  }

  private async decodeSingleWithFallbacks(
    canvas: HTMLCanvasElement,
  ): Promise<BarcodeResult | null> {
    return decodeWithFallbacks(this.decoder, canvas, {
      tryDirect: true,
      multiScale: this.options.multiScale ?? true,
      rotationRetry: this.options.rotationRetry ?? true,
      imageEnhancement: this.options.imageEnhancement ?? true,
      forceTryHarderOnFallback: true,
      restoreTryHarder: this.options.tryHarder ?? true,
    });
  }

  private async toCanvas(source: ImageSource) {
    const { maxWidth, maxHeight } = this.options;

    if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
      return drawImageElement(source, maxWidth, maxHeight);
    }
    if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
      return drawCanvasElement(source, maxWidth, maxHeight);
    }
    if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
      return drawVideoFrame(source, maxWidth, maxHeight);
    }
    if (typeof Blob !== "undefined" && source instanceof Blob) {
      return drawBlob(source, maxWidth, maxHeight);
    }

    throw new BarcodeError(
      "IMAGE_LOAD_FAILED",
      "Unsupported image source type for scanImage().",
    );
  }
}
