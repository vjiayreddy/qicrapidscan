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
  exactRoiRect,
  findContainingRoiIndex,
  paddedRoiRect,
  withRoiDecodeStatus,
} from "./hybridHelpers.js";
import type {
  HybridScanProgress,
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

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export interface HybridImageScanOptions {
  localizer: OnnxBarcodeLocalizer;
  /**
   * Extra padding around each YOLO box before decode.
   * Set to `0` (or negative) for an exact box crop — no pad, no square
   * expand, no linear quiet-zone floors, and no wider-pad miss retry.
   */
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
  /** Optional UI progress (localize → ROI i/n → full-frame). */
  onProgress?: (progress: HybridScanProgress) => void;
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
 *
 * Fast path: prepared zxing per ROI first. Heavy multi-scale / OpenCV only on
 * misses so typical labels finish without the full decode ladder.
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
  const report = (progress: HybridScanProgress) => {
    try {
      options.onProgress?.(progress);
    } catch {
      // Progress must never break decode.
    }
  };

  report({ phase: "localizing", message: "Localizing barcodes…" });

  let locate;
  try {
    locate = await options.localizer.locate({ imageData, maxRois });
  } catch (error) {
    report({ phase: "full_frame", message: "Localization failed — full-frame decode…" });
    const full = await options.fullFrameDecode();
    report({
      phase: "done",
      message: "Done",
      decodedCount: full.length,
    });
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
    report({ phase: "full_frame", message: "No boxes — full-frame decode…" });
    const full = await options.fullFrameDecode();
    report({
      phase: "done",
      message: "Done",
      decodedCount: full.length,
    });
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
  const exactCrop = padRatio <= 0;
  const roiTotal = locate.rois.length;

  async function decodeRoi(
    roi: LocalizationRoi,
    overrides: {
      padRatio?: number;
      heavy?: boolean;
    } = {},
  ): Promise<{
    results: BarcodeResult[];
    crop: LocalizationRoi["crop"];
    previewDataUrl?: string;
  }> {
    const effectivePad = overrides.padRatio ?? padRatio;
    const crop =
      exactCrop || effectivePad <= 0
        ? exactRoiRect(roi, canvas.width, canvas.height)
        : paddedRoiRect(roi, canvas.width, canvas.height, effectivePad, {
            square: localizerLabelUsesSquareCrop(roi.label),
            minPadPx: 4,
          });
    const roiFormats = formatsForRoi(roi, options.formats);
    const useCascade =
      (options.opencvCascade ?? true) &&
      localizerLabelUsesOpencvCascade(roi.label);
    const heavy = overrides.heavy === true;

    const { results, cascadePreviewDataUrl, rawCropDataUrl } = await scanRegion(
      decoder,
      canvas,
      { ...crop, depth: 0 },
      heavy
        ? {
            regionFallbacks: options.regionFallbacks ?? true,
            multiScale: options.multiScale ?? true,
            imageEnhancement: options.imageEnhancement ?? true,
            rotationRetry: options.rotationRetry ?? true,
            tryHarder: options.tryHarder ?? true,
            opencvCascade: useCascade,
            formats: roiFormats,
            openCvScriptUrl: options.openCvScriptUrl,
            preparedZxingDecode: true,
          }
        : {
            // Fast path: prepared zxing (+ raw decodeAll). Skip multi-scale /
            // OpenCV until a miss forces the heavy pass.
            regionFallbacks: false,
            multiScale: false,
            imageEnhancement: false,
            rotationRetry: false,
            tryHarder: options.tryHarder ?? true,
            opencvCascade: false,
            formats: roiFormats,
            openCvScriptUrl: options.openCvScriptUrl,
            preparedZxingDecode: true,
          },
    );
    return {
      results,
      crop,
      previewDataUrl:
        results.length > 0
          ? (cascadePreviewDataUrl ?? rawCropDataUrl)
          : (rawCropDataUrl ?? cascadePreviewDataUrl),
    };
  }

  for (let index = 0; index < locate.rois.length; index += 1) {
    const roi = locate.rois[index]!;
    report({
      phase: "decoding_rois",
      message: `Decoding box ${index + 1} of ${roiTotal}…`,
      roiIndex: index + 1,
      roiTotal,
      decodedCount: batches.flat().length,
    });
    await yieldToUi();

    let { results: mapped, crop, previewDataUrl } = await decodeRoi(roi);
    // Heavy ladder only when the fast path misses.
    if (mapped.length === 0) {
      ({ results: mapped, crop, previewDataUrl } = await decodeRoi(roi, {
        heavy: true,
      }));
    }

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
  // Skipped for exact-crop mode (`roiPadding <= 0`) so thumbs/decode stay
  // on the raw YOLO box.
  if (!exactCrop) {
    for (let index = 0; index < rois.length; index += 1) {
      if (rois[index]?.decoded) continue;
      report({
        phase: "retrying_rois",
        message: `Retrying box ${index + 1} of ${roiTotal}…`,
        roiIndex: index + 1,
        roiTotal,
        decodedCount: batches.flat().length,
      });
      await yieldToUi();

      const source = locate.rois[index]!;
      let { results: mapped, crop, previewDataUrl } = await decodeRoi(source, {
        padRatio: Math.max(padRatio, RETRY_ROI_PADDING),
      });
      if (mapped.length === 0) {
        ({ results: mapped, crop, previewDataUrl } = await decodeRoi(source, {
          padRatio: Math.max(padRatio, RETRY_ROI_PADDING),
          heavy: true,
        }));
      }
      if (mapped.length === 0) continue;
      rois[index] = {
        ...withRoiDecodeStatus(source, mapped),
        crop,
        previewDataUrl,
      };
      batches.push(mapped);
    }
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

  // Early exit when every YOLO box already decoded — skip tiling/zxing fill.
  if (failedIndexes.length === 0 && batches.flat().length > 0) {
    const merged = dedupeResults(batches.flat()).slice(0, maxResults);
    const dedupedRois = dedupeLocalizationRois(rois);
    report({
      phase: "done",
      message: "Done",
      roiTotal,
      decodedCount: merged.length,
    });
    return {
      results: merged,
      localization: {
        rois: dedupedRois,
        backend: "onnx",
        elapsedMs: performance.now() - started,
        usedFallback: false,
      },
    };
  }

  if (failedIndexes.length > 0) {
    report({
      phase: "full_frame",
      message: `Full-frame fill (${failedIndexes.length} missed)…`,
      roiTotal,
      decodedCount: batches.flat().length,
    });
    await absorbFullFrame(await options.fullFrameDecode());
  }

  // Direct zxing-wasm full-frame pass when ROI + detector still miss.
  if (failedIndexes.length > 0 || batches.flat().length === 0) {
    report({
      phase: "full_frame",
      message: "Full-frame zxing pass…",
      roiTotal,
      decodedCount: batches.flat().length,
    });
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

  report({
    phase: "done",
    message: "Done",
    roiTotal,
    decodedCount: merged.length,
  });

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
