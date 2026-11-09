import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { dedupeResults } from "../detection/Deduplicator.js";
import { scanRegion } from "../detection/RegionScanner.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "../processing/canvas.js";
import { DEFAULT_ROI_PADDING, RETRY_ROI_PADDING } from "./constants.js";
import {
  dedupeLocalizationRois,
  findContainingRoiIndex,
  paddedRoiRect,
  withRoiDecodeStatus,
} from "./hybridHelpers.js";
import type {
  ImageLocalization,
  LocalizationRoi,
  OnnxBarcodeLocalizer,
} from "./types.js";

export interface HybridImageScanOptions {
  localizer: OnnxBarcodeLocalizer;
  roiPadding?: number;
  maxRois?: number;
  maxResults?: number;
  regionFallbacks?: boolean;
  multiScale?: boolean;
  imageEnhancement?: boolean;
  rotationRetry?: boolean;
  tryHarder?: boolean;
  /** Full-frame / tiling fallback when ROI crops miss. */
  fullFrameDecode: () => Promise<BarcodeResult[]>;
}

export interface HybridImageScanOutcome {
  results: BarcodeResult[];
  localization: ImageLocalization;
}

function centroidOf(result: BarcodeResult): { x: number; y: number } | null {
  if (result.points && result.points.length > 0) {
    let x = 0;
    let y = 0;
    for (const p of result.points) {
      x += p.x;
      y += p.y;
    }
    return { x: x / result.points.length, y: y / result.points.length };
  }
  if (result.boundingBox) {
    return {
      x: result.boundingBox.x + result.boundingBox.width / 2,
      y: result.boundingBox.y + result.boundingBox.height / 2,
    };
  }
  return null;
}

/**
 * Locate barcodes with ONNX, decode each padded ROI, then full-frame-fill misses.
 */
export async function hybridImageScan(
  decoder: DecoderAdapter,
  canvas: HTMLCanvasElement,
  options: HybridImageScanOptions,
): Promise<HybridImageScanOutcome> {
  const started = performance.now();
  const ctx = get2dContext(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const padRatio = options.roiPadding ?? DEFAULT_ROI_PADDING;
  const maxRois = options.maxRois ?? Math.max(32, (options.maxResults ?? 16) * 4);
  const maxResults = options.maxResults ?? 64;

  let locate;
  try {
    locate = await options.localizer.locate({ imageData, maxRois });
  } catch (error) {
    const full = await options.fullFrameDecode();
    return {
      results: full.slice(0, maxResults),
      localization: {
        rois: [],
        backend: "none",
        elapsedMs: performance.now() - started,
        usedFallback: true,
        fallbackReason:
          error instanceof Error ? error.message : "locate_failed",
      },
    };
  }

  if (locate.backend !== "onnx" || locate.rois.length === 0) {
    const full = await options.fullFrameDecode();
    return {
      results: full.slice(0, maxResults),
      localization: {
        rois: locate.rois,
        backend: locate.backend === "onnx" ? "onnx" : "passthrough",
        elapsedMs: performance.now() - started,
        usedFallback: true,
        fallbackReason:
          locate.fallbackReason ??
          (locate.rois.length === 0 ? "no_rois" : "passthrough"),
      },
    };
  }

  const batches: BarcodeResult[][] = [];
  const rois: LocalizationRoi[] = [];

  async function decodeRoi(
    roi: LocalizationRoi,
    pad: number,
  ): Promise<BarcodeResult[]> {
    const region = {
      ...paddedRoiRect(roi, canvas.width, canvas.height, pad),
      depth: 0,
    };
    return scanRegion(decoder, canvas, region, {
      regionFallbacks: options.regionFallbacks ?? true,
      multiScale: options.multiScale ?? true,
      imageEnhancement: options.imageEnhancement ?? true,
      rotationRetry: options.rotationRetry ?? true,
      tryHarder: options.tryHarder ?? true,
    });
  }

  for (const roi of locate.rois) {
    let mapped = await decodeRoi(roi, padRatio);
    if (mapped.length === 0) {
      mapped = await decodeRoi(roi, Math.max(padRatio, RETRY_ROI_PADDING));
    }
    rois.push(withRoiDecodeStatus(roi, mapped));
    if (mapped.length > 0) {
      batches.push(mapped);
    }
  }

  const failedIndexes = rois
    .map((roi, index) => (roi.decoded ? -1 : index))
    .filter((index) => index >= 0);

  if (failedIndexes.length > 0) {
    const full = await options.fullFrameDecode();
    for (const result of full) {
      const center = centroidOf(result);
      if (!center) continue;
      const idx = findContainingRoiIndex(center, rois);
      if (idx < 0 || rois[idx]?.decoded) continue;
      if (!failedIndexes.includes(idx)) continue;
      const roi = rois[idx]!;
      const next = withRoiDecodeStatus(roi, [
        ...(roi.texts ?? []).map((text, i) => ({
          text,
          format: roi.formats?.[i] ?? result.format,
        })),
        { text: result.text, format: result.format },
      ]);
      rois[idx] = next;
      batches.push([result]);
    }
  }

  const merged = dedupeResults(batches.flat()).slice(0, maxResults);
  const dedupedRois = dedupeLocalizationRois(rois);

  return {
    results: merged,
    localization: {
      rois: dedupedRois,
      backend: "onnx",
      elapsedMs: performance.now() - started,
      usedFallback: failedIndexes.length > 0,
      fallbackReason:
        failedIndexes.length > 0 ? "partial_full_frame_fill" : undefined,
    },
  };
}
