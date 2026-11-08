export { BarcodeScanner } from "./scanner/BarcodeScanner.js";
export type { BarcodeScannerDependencies } from "./scanner/BarcodeScanner.js";
export { BarcodeError } from "./errors/index.js";
export type { BarcodeErrorCode } from "./errors/index.js";
export {
  DEFAULT_FORMATS,
  ALL_SUPPORTED_FORMATS,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
} from "./decoder/formats.js";
export { createDefaultDecoder } from "./decoder/ZXingDecoder.js";
export {
  selectLiveFormatBand,
  LIVE_FORMAT_BAND_TARGET,
} from "./decoder/liveFormatBand.js";
export { MultiBarcodeDetector } from "./detection/MultiBarcodeDetector.js";
export { detectMultipleFromRaster } from "./detection/RasterMultiDetect.js";
export {
  ResultTracker,
  toTrackedDecode,
  adaptiveSmooth,
} from "./detection/ResultTracker.js";
export type {
  TrackedDecode,
  TrackerOptions,
  TrackerTick,
} from "./detection/ResultTracker.js";
export {
  cropBarcodeFrame,
  computeCropRect,
  enhanceCropPixels,
  softenCropPixels,
} from "./processing/cropBarcode.js";
export type {
  CropSource,
  CropBarcodeOptions,
  CropRect,
} from "./processing/cropBarcode.js";
export { annotateBarcodeImage } from "./processing/annotateBarcodeImage.js";
export type {
  AnnotateSource,
  AnnotateBarcodeImageOptions,
} from "./processing/annotateBarcodeImage.js";
export {
  computeCenterZoomGeometry,
  createCenterZoomCanvas,
  mapResultsFromCenterZoom,
} from "./processing/centerZoom.js";
export type {
  CenterZoomOptions,
  CenterZoomGeometry,
  CenterZoomCanvas,
} from "./processing/centerZoom.js";
export {
  decodeWithFallbacks,
  resizeCanvas,
  rotateCanvas,
  enhanceForDecode,
  mapResultFromScale,
  mapResultFromRotation,
  unrotatePoint,
  DEFAULT_DECODE_SCALES,
  DEFAULT_DECODE_ROTATIONS,
} from "./processing/decodePipeline.js";
export type {
  DecodePipelineOptions,
  DecodeRotationDegrees,
  OwnedCanvas,
} from "./processing/decodePipeline.js";
export type { DuplicateFilterMode } from "./processing/DuplicateFilter.js";
export {
  toCornerPoints,
  scaleResultsToSource,
  boundingBoxFromPoints,
} from "./detection/geometry.js";
export type { MultiDetectLimits, MultiDetectStats } from "./detection/types.js";
export type {
  BarcodeFormat,
  BarcodeResult,
  BarcodeScannerOptions,
  CameraDevice,
  MultiDetectionOptions,
} from "./types/index.js";
