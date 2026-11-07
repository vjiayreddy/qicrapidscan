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
    /** Deferred for first release — always treated as false in Phase 1–2. */
    useWorker?: boolean;
  };
  duplicateFilter?: {
    enabled?: boolean;
    cooldown?: number;
  };
}
