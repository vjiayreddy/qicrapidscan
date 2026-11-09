import type { BarcodeFormat } from "./barcode.types.js";
import type { LocalizationOptions } from "../localization/types.js";

export interface MultiDetectionOptions {
  multiple?: boolean;
  maxResults?: number;
  maxRegions?: number;
  maxDepth?: number;
  overlap?: number;
  /** Wall-clock budget for one multi-detect pass (ms). */
  maxTimeMs?: number;
}

export interface BarcodeScannerOptions {
  formats?: BarcodeFormat[];
  camera?: {
    deviceId?: string;
    facingMode?: "user" | "environment";
    width?: number;
    height?: number;
    frameRate?: number;
  };
  detection?: MultiDetectionOptions;
  performance?: {
    scanInterval?: number;
    maxWidth?: number;
    maxHeight?: number;
    /**
     * ZXing TRY_HARDER. Default true for thorough decoding. Live cost is still
     * capped by `liveFormatBanding`. Fallback passes also force TRY_HARDER.
     */
    tryHarder?: boolean;
    /**
     * Attempt inverted barcodes (ZXing ALSO_INVERTED when available, otherwise
     * a second inverted-luminance decode). Default true.
     */
    alsoInverted?: boolean;
    /**
     * Still-image multi-scale decode ladder (1× / 1.5× / 2×) after an initial
     * miss. Default true. Live scanning uses `liveZoom` instead.
     */
    multiScale?: boolean;
    /**
     * Still-image rotation retries (0° / 90° / 180° / 270°) after scale /
     * enhancement misses. Default true for stills; live frames skip rotation.
     */
    rotationRetry?: boolean;
    /**
     * Contrast/grayscale (+ mild sharpen) decode fallback after scale misses.
     * Default true. On live frames, runs once on the zoom canvas only.
     */
    imageEnhancement?: boolean;
    /**
     * When more than 4 formats are enabled, live frames rotate a ≤4-format band
     * so per-frame cost stays close to 2D-only. Default true.
     */
    liveFormatBanding?: boolean;
    /**
     * When the full-frame live decode finds nothing, run a center crop + upscale
     * pass so far/small symbols still have enough module resolution. Default true.
     */
    liveZoom?: boolean;
    /** Center crop fraction for `liveZoom` (0.25–1). Default 0.55. */
    liveZoomCropRatio?: number;
    /** Upscale factor after the live zoom crop (≥ 1). Default 2. */
    liveZoomScale?: number;
    /** Deferred for first release — always treated as false in Phase 1–2. */
    useWorker?: boolean;
  };
  duplicateFilter?: {
    enabled?: boolean;
    /** Cooldown window in ms when mode is "cooldown". Default 1500. */
    cooldown?: number;
    /**
     * "cooldown" — suppress the same format:text for `cooldown` ms.
     * "once" — never re-emit the same format:text until clear/stop.
     */
    mode?: "cooldown" | "once";
  };
  /**
   * When true, live accepts and `scanImage()` results include a JPEG
   * `cropDataUrl` thumbnail of the barcode region. Default false.
   */
  captureCrop?: boolean;
  /**
   * Opt-in ONNX YOLO localize→crop→decode for still-image `scanImage()` only.
   * Live camera is unchanged. Soft-fails to tiling/decode-only when the model
   * or ORT runtime is unavailable.
   */
  localization?: LocalizationOptions;
}
