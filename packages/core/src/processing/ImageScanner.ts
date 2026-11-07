import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { MultiBarcodeDetector } from "../detection/MultiBarcodeDetector.js";
import type { MultiDetectLimits, MultiDetectStats } from "../detection/types.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { BarcodeError } from "../errors/BarcodeError.js";
import {
  drawBlob,
  drawCanvasElement,
  drawImageElement,
  drawVideoFrame,
} from "./canvas.js";

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
        const detector = new MultiBarcodeDetector(this.decoder, this.options.multiLimits);
        const outcome = detector.detect(sized.canvas);
        return { results: outcome.results, stats: outcome.stats };
      }

      const result = this.decoder.decode({
        canvas: sized.canvas,
        sourceWidth: sized.sourceWidth,
        sourceHeight: sized.sourceHeight,
      });
      return { results: result ? [result] : [] };
    } finally {
      sized.cleanup();
    }
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
