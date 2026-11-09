import { BarcodeError } from "../errors/BarcodeError.js";
import { assertSupportedFormats, DEFAULT_FORMATS } from "../decoder/formats.js";
import {
  DEFAULT_CLASS_NAME,
  DEFAULT_INPUT_SIZE,
  DEFAULT_IOU_THRESHOLD,
  DEFAULT_ROI_PADDING,
  DEFAULT_SCORE_THRESHOLD,
} from "../localization/constants.js";
import type { BarcodeScannerOptions } from "../types/scanner.types.js";
import type { BarcodeFormat } from "../types/barcode.types.js";

export interface ResolvedLocalizationOptions {
  enabled: boolean;
  modelUrl: string;
  ortWasmBaseUrl: string;
  scoreThreshold: number;
  iouThreshold: number;
  inputSize: number;
  roiPadding: number;
  maxRois: number;
  className: string;
}

export interface ResolvedScannerOptions {
  formats: BarcodeFormat[];
  camera: BarcodeScannerOptions["camera"];
  detection: {
    multiple: boolean;
    maxResults: number;
    maxRegions: number;
    maxDepth: number;
    overlap: number;
    maxTimeMs: number;
  };
  performance: {
    scanInterval: number;
    maxWidth: number;
    maxHeight: number;
    tryHarder: boolean;
    alsoInverted: boolean;
    multiScale: boolean;
    rotationRetry: boolean;
    imageEnhancement: boolean;
    liveFormatBanding: boolean;
    liveZoom: boolean;
    liveZoomCropRatio: number;
    liveZoomScale: number;
    useWorker: boolean;
  };
  duplicateFilter: {
    enabled: boolean;
    cooldown: number;
    mode: "cooldown" | "once";
  };
  captureCrop: boolean;
  localization: ResolvedLocalizationOptions;
}

function assertPositiveNumber(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new BarcodeError("SCAN_FAILED", `Invalid option "${name}": expected a non-negative number.`);
  }
}

export function resolveOptions(options: BarcodeScannerOptions = {}): ResolvedScannerOptions {
  const formats = options.formats?.length ? [...options.formats] : [...DEFAULT_FORMATS];
  assertSupportedFormats(formats);

  assertPositiveNumber("camera.width", options.camera?.width);
  assertPositiveNumber("camera.height", options.camera?.height);
  assertPositiveNumber("camera.frameRate", options.camera?.frameRate);
  assertPositiveNumber("detection.maxResults", options.detection?.maxResults);
  assertPositiveNumber("detection.maxRegions", options.detection?.maxRegions);
  assertPositiveNumber("detection.maxDepth", options.detection?.maxDepth);
  assertPositiveNumber("detection.overlap", options.detection?.overlap);
  assertPositiveNumber("detection.maxTimeMs", options.detection?.maxTimeMs);
  assertPositiveNumber("performance.scanInterval", options.performance?.scanInterval);
  assertPositiveNumber("performance.maxWidth", options.performance?.maxWidth);
  assertPositiveNumber("performance.maxHeight", options.performance?.maxHeight);
  assertPositiveNumber("performance.liveZoomCropRatio", options.performance?.liveZoomCropRatio);
  assertPositiveNumber("performance.liveZoomScale", options.performance?.liveZoomScale);
  assertPositiveNumber("duplicateFilter.cooldown", options.duplicateFilter?.cooldown);
  assertPositiveNumber("localization.scoreThreshold", options.localization?.scoreThreshold);
  assertPositiveNumber("localization.iouThreshold", options.localization?.iouThreshold);
  assertPositiveNumber("localization.inputSize", options.localization?.inputSize);
  assertPositiveNumber("localization.roiPadding", options.localization?.roiPadding);
  assertPositiveNumber("localization.maxRois", options.localization?.maxRois);

  if (
    options.detection?.overlap !== undefined &&
    (options.detection.overlap < 0 || options.detection.overlap >= 1)
  ) {
    throw new BarcodeError(
      "SCAN_FAILED",
      'Invalid option "detection.overlap": expected a value in [0, 1).',
    );
  }

  if (
    options.performance?.liveZoomCropRatio !== undefined &&
    (options.performance.liveZoomCropRatio < 0.25 ||
      options.performance.liveZoomCropRatio > 1)
  ) {
    throw new BarcodeError(
      "SCAN_FAILED",
      'Invalid option "performance.liveZoomCropRatio": expected a value in [0.25, 1].',
    );
  }

  if (
    options.performance?.liveZoomScale !== undefined &&
    options.performance.liveZoomScale < 1
  ) {
    throw new BarcodeError(
      "SCAN_FAILED",
      'Invalid option "performance.liveZoomScale": expected a value >= 1.',
    );
  }

  const duplicateMode = options.duplicateFilter?.mode ?? "cooldown";
  if (duplicateMode !== "cooldown" && duplicateMode !== "once") {
    throw new BarcodeError(
      "SCAN_FAILED",
      'Invalid option "duplicateFilter.mode": expected "cooldown" or "once".',
    );
  }

  const localizationEnabled = options.localization?.enabled === true;
  if (localizationEnabled) {
    if (!options.localization?.modelUrl?.trim()) {
      throw new BarcodeError(
        "SCAN_FAILED",
        'Invalid option "localization.modelUrl": required when localization.enabled is true.',
      );
    }
    if (!options.localization?.ortWasmBaseUrl?.trim()) {
      throw new BarcodeError(
        "SCAN_FAILED",
        'Invalid option "localization.ortWasmBaseUrl": required when localization.enabled is true.',
      );
    }
  }

  return {
    formats,
    camera: options.camera,
    detection: {
      multiple: options.detection?.multiple ?? false,
      maxResults: options.detection?.maxResults ?? 10,
      // Keep multi-detect budgets modest — decode runs on the main thread today.
      maxRegions: options.detection?.maxRegions ?? 8,
      maxDepth: options.detection?.maxDepth ?? 2,
      overlap: options.detection?.overlap ?? 0.2,
      // Allow enough time for tile passes after the full-frame decode.
      maxTimeMs: options.detection?.maxTimeMs ?? 250,
    },
    performance: {
      scanInterval: options.performance?.scanInterval ?? 150,
      maxWidth: options.performance?.maxWidth ?? 1280,
      maxHeight: options.performance?.maxHeight ?? 720,
      tryHarder: options.performance?.tryHarder ?? true,
      alsoInverted: options.performance?.alsoInverted ?? true,
      multiScale: options.performance?.multiScale ?? true,
      rotationRetry: options.performance?.rotationRetry ?? true,
      imageEnhancement: options.performance?.imageEnhancement ?? true,
      liveFormatBanding: options.performance?.liveFormatBanding ?? true,
      liveZoom: options.performance?.liveZoom ?? true,
      liveZoomCropRatio: options.performance?.liveZoomCropRatio ?? 0.55,
      liveZoomScale: options.performance?.liveZoomScale ?? 2,
      // Deferred — Phase 2 always main-thread.
      useWorker: false,
    },
    duplicateFilter: {
      enabled: options.duplicateFilter?.enabled ?? true,
      cooldown: options.duplicateFilter?.cooldown ?? 1500,
      mode: duplicateMode,
    },
    captureCrop: options.captureCrop ?? false,
    localization: {
      enabled: localizationEnabled,
      modelUrl: options.localization?.modelUrl?.trim() ?? "",
      ortWasmBaseUrl: options.localization?.ortWasmBaseUrl?.trim() ?? "",
      scoreThreshold:
        options.localization?.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD,
      iouThreshold: options.localization?.iouThreshold ?? DEFAULT_IOU_THRESHOLD,
      inputSize: options.localization?.inputSize ?? DEFAULT_INPUT_SIZE,
      roiPadding: options.localization?.roiPadding ?? DEFAULT_ROI_PADDING,
      maxRois:
        options.localization?.maxRois ??
        Math.max(32, (options.detection?.maxResults ?? 10) * 4),
      className: options.localization?.className ?? DEFAULT_CLASS_NAME,
    },
  };
}
