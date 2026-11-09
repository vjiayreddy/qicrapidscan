import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { dedupeResults } from "../detection/Deduplicator.js";
import { scanRegion } from "../detection/RegionScanner.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "../processing/canvas.js";
import type { BarcodeFormat } from "../types/barcode.types.js";
import { decodeCanvasWithZxing } from "../processing/zxingFormats.js";
import {
  DEFAULT_ROI_PADDING,
  RETRY_ROI_PADDING,
  localizerLabelToFormat,
  localizerLabelUsesOpencvCascade,
  localizerLabelUsesSquareCrop,
} from "./constants.js";
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

/**
 * Prefer YOLO class → format when enabled, but always keep the full enabled
 * set so mislabeled Code128/DataMatrix ROIs still decode.
 */
function formatsForRoi(
  roi: LocalizationRoi,
  enabled: readonly BarcodeFormat[] | undefined,
): BarcodeFormat[] | undefined {
  const hinted = localizerLabelToFormat(roi.label);
  if (!enabled || enabled.length === 0) {
    return hinted ? [hinted] : undefined;
  }
  if (hinted && enabled.includes(hinted)) {
    return [hinted, ...enabled.filter((format) => format !== hinted)];
  }
  return [...enabled];
}

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
  /**
   * OpenCV.js + zxing-wasm recovery cascade on each YOLO crop.
   * Default true — soft-skips when OpenCV cannot load.
   */
  opencvCascade?: boolean;
  /** Formats forwarded to the cascade / region decoder. */
  formats?: readonly BarcodeFormat[];
  /** Staged opencv.js URL for the ROI cascade (playground / Next). */
  openCvScriptUrl?: string;
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
    overrides: { padRatio?: number } = {},
  ): Promise<{
    results: BarcodeResult[];
    crop: LocalizationRoi["crop"];
    previewDataUrl?: string;
  }> {
    const square = localizerLabelUsesSquareCrop(roi.label);
    const crop = paddedRoiRect(
      roi,
      canvas.width,
      canvas.height,
      overrides.padRatio ?? padRatio,
      {
        square,
        minPadPx: 4,
      },
    );
    const roiFormats = formatsForRoi(roi, options.formats);
    const useCascade =
      (options.opencvCascade ?? true) &&
      localizerLabelUsesOpencvCascade(roi.label);
    const { results, cascadePreviewDataUrl, rawCropDataUrl } = await scanRegion(
      decoder,
      canvas,
      { ...crop, depth: 0 },
      {
        regionFallbacks: options.regionFallbacks ?? true,
        multiScale: options.multiScale ?? true,
        imageEnhancement: options.imageEnhancement ?? true,
        rotationRetry: options.rotationRetry ?? true,
        tryHarder: options.tryHarder ?? true,
        opencvCascade: useCascade,
        formats: roiFormats,
        openCvScriptUrl: options.openCvScriptUrl,
      },
    );
    // Prefer raw YOLO crop for UI thumbs — cascade miss previews are often
    // washed-out gray and hide why decode failed.
    return {
      results,
      crop,
      previewDataUrl:
        results.length > 0
          ? (cascadePreviewDataUrl ?? rawCropDataUrl)
          : (rawCropDataUrl ?? cascadePreviewDataUrl),
    };
  }

  for (const roi of locate.rois) {
    const { results: mapped, crop, previewDataUrl } = await decodeRoi(roi);
    rois.push({
      ...withRoiDecodeStatus(roi, mapped),
      crop,
      previewDataUrl,
    });
    if (mapped.length > 0) {
      batches.push(mapped);
    }
  }

  // Wider pad retry for misses (quiet zone / clipped Code128 bars).
  for (let index = 0; index < rois.length; index += 1) {
    if (rois[index]?.decoded) continue;
    const source = locate.rois[index]!;
    const { results: mapped, crop, previewDataUrl } = await decodeRoi(source, {
      padRatio: Math.max(padRatio, RETRY_ROI_PADDING),
    });
    if (mapped.length === 0) continue;
    rois[index] = {
      ...withRoiDecodeStatus(source, mapped),
      crop,
      previewDataUrl,
    };
    batches.push(mapped);
  }

  let failedIndexes = rois
    .map((roi, index) => (roi.decoded ? -1 : index))
    .filter((index) => index >= 0);

  async function absorbFullFrame(full: BarcodeResult[]): Promise<void> {
    for (const result of full) {
      batches.push([result]);
      const center = centroidOf(result);
      if (!center) continue;
      const idx = findContainingRoiIndex(center, rois);
      if (idx < 0 || rois[idx]?.decoded) continue;
      if (!failedIndexes.includes(idx)) continue;
      const roi = rois[idx]!;
      rois[idx] = withRoiDecodeStatus(roi, [
        ...(roi.texts ?? []).map((text, i) => ({
          text,
          format: roi.formats?.[i] ?? result.format,
        })),
        { text: result.text, format: result.format },
      ]);
    }
    failedIndexes = rois
      .map((roi, index) => (roi.decoded ? -1 : index))
      .filter((index) => index >= 0);
  }

  if (failedIndexes.length > 0) {
    await absorbFullFrame(await options.fullFrameDecode());
  }

  // Direct zxing-wasm full-frame pass when ROI + detector still miss.
  if (failedIndexes.length > 0 || batches.flat().length === 0) {
    try {
      const zxingHits = await decodeCanvasWithZxing(canvas, options.formats);
      if (zxingHits.length > 0) {
        await absorbFullFrame(zxingHits);
      }
    } catch {
      // Soft-skip — ROI cascade / detector already tried.
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
