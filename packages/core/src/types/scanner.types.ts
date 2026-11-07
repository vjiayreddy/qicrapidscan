import type { BarcodeFormat } from "./barcode.types.js";

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
     * ZXing TRY_HARDER. Default false — much faster for live 1D, slightly less
     * tolerant of blur/low contrast. Enable for difficult still images if needed.
     */
    tryHarder?: boolean;
    /**
     * When more than 4 formats are enabled, live frames rotate a ≤4-format band
     * so per-frame cost stays close to 2D-only. Default true.
     */
    liveFormatBanding?: boolean;
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
   * When true, live accepts include a JPEG `cropDataUrl` thumbnail of the
   * barcode region. Default false.
   */
  captureCrop?: boolean;
}
