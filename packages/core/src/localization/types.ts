/** Axis-aligned barcode region in source image pixels. */
export interface LocalizationRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
  label?: string;
  /** True when ZXing decoded at least one code inside this ROI crop. */
  decoded?: boolean;
  /** Decoded payload(s) for this ROI (empty when not decoded). */
  texts?: string[];
  formats?: string[];
}

export interface ImageLocalization {
  rois: LocalizationRoi[];
  backend: "onnx" | "passthrough" | "none";
  elapsedMs: number;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface LocateInput {
  imageData: ImageData;
  maxRois?: number;
}

export interface LocateResult {
  rois: LocalizationRoi[];
  backend: "onnx" | "passthrough";
  elapsedMs: number;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface OnnxLocalizerInitOptions {
  /** Absolute or root-relative URL to the ONNX model. */
  modelUrl: string;
  /**
   * Base URL for onnxruntime-web WASM files (trailing slash recommended).
   * Example: `/assets/ort/`
   */
  ortWasmBaseUrl: string;
  /** Score threshold after class channel (default 0.25). */
  scoreThreshold?: number;
  /** NMS IoU threshold (default 0.45). */
  iouThreshold?: number;
  /** Model input edge length (default 1280 for YOLO26 export). */
  inputSize?: number;
  /** Class label for detections (default "item"). */
  className?: string;
}

export interface OnnxBarcodeLocalizer {
  readonly backend: "onnx";
  readonly ready: boolean;
  initialize(options: OnnxLocalizerInitOptions): Promise<void>;
  locate(input: LocateInput): Promise<LocateResult>;
  destroy(): Promise<void>;
}

export interface LocalizationOptions {
  enabled?: boolean;
  modelUrl?: string;
  ortWasmBaseUrl?: string;
  scoreThreshold?: number;
  iouThreshold?: number;
  inputSize?: number;
  /** Extra padding around each ROI as a fraction of box size. Default 0.18. */
  roiPadding?: number;
  maxRois?: number;
  /** Detection class label (default "item"). */
  className?: string;
}
