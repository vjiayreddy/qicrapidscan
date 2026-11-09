/** Default YOLO26 export input edge (matches datamatrix-model.onnx imgsz). */
export const DEFAULT_INPUT_SIZE = 1280;

export const DEFAULT_SCORE_THRESHOLD = 0.25;

export const DEFAULT_IOU_THRESHOLD = 0.45;

export const DEFAULT_CLASS_NAME = "item";

/**
 * Extra padding around the YOLO box before decode.
 * 10% keeps a thin quiet-zone margin without pulling in bottle curve / label text.
 */
export const DEFAULT_ROI_PADDING = 0.1;

/**
 * Legacy wider pad (kept for callers that opt in manually).
 */
export const RETRY_ROI_PADDING = 0.28;
