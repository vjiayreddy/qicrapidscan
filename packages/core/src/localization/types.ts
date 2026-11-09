/** Axis-aligned barcode region in source image pixels. */
export interface LocalizationRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
  /** YOLO class label (e.g. Code128, datamatrix). */
  label?: string;
  /** YOLO class channel index when multi-class. */
  classId?: number;
  /**
   * Actual padded square crop used for decode (source pixels).
   * Prefer this over raw x/y/width/height when rendering failed thumbs.
   */
  crop?: { x: number; y: number; width: number; height: number };
  /**
   * Decode thumb: raw YOLO crop on miss; cascade enhancement on hit.
   * Failed thumbs should show the raw crop (not washed cascade miss).
   */
  previewDataUrl?: string;
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
  /**
   * Fallback label when classNames is omitted / single-class models.
   * Default "item".
   */
  className?: string;
  /**
   * Ordered YOLO class names matching the model head (channel 4…).
   * Pharma multi-barcode model: Code128, PDF417, QRCode, UPCA, datamatrix.
   */
  classNames?: readonly string[];
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
  /** Extra padding around each ROI as a fraction of box size. Default 0.1. */
  roiPadding?: number;
  maxRois?: number;
  /**
   * Fallback detection class label for single-class models (default "item").
   */
  className?: string;
  /**
   * Ordered YOLO class names for multi-class models (e.g. pharma_multibarcodes).
   */
  classNames?: readonly string[];
  /**
   * URL to a staged `opencv.js` for the ROI recovery cascade.
   * Preferred in Next.js apps so Webpack never bundles `@techstark/opencv-js`
   * (which requires Node `fs`). Example: `/assets/opencv/opencv.js`.
   */
  openCvScriptUrl?: string;
}
