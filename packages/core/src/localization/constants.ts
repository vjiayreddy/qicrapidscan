/** Default YOLO26 export input edge (matches datamatrix-model.onnx imgsz). */
export const DEFAULT_INPUT_SIZE = 1280;

export const DEFAULT_SCORE_THRESHOLD = 0.25;

export const DEFAULT_IOU_THRESHOLD = 0.45;

export const DEFAULT_CLASS_NAME = "item";

/** Quiet-zone padding for DataMatrix crops. */
export const DEFAULT_ROI_PADDING = 0.18;

/** Wider pad retry when the first crop decode misses. */
export const RETRY_ROI_PADDING = 0.28;
