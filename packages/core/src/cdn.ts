/**
 * CDN entry — same public surface as the npm package.
 * IIFE build exposes these as `window.QicRapidScan.*`.
 */
export {
  BarcodeScanner,
  BarcodeError,
  DEFAULT_FORMATS,
  ALL_SUPPORTED_FORMATS,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
  createDefaultDecoder,
  MultiBarcodeDetector,
  detectMultipleFromRaster,
} from "./index.js";

export type {
  BarcodeScannerDependencies,
  BarcodeErrorCode,
  MultiDetectLimits,
  MultiDetectStats,
  BarcodeFormat,
  BarcodeResult,
  BarcodeScannerOptions,
  CameraDevice,
  MultiDetectionOptions,
} from "./index.js";
