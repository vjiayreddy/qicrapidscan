export { BarcodeScanner } from "./components/BarcodeScanner.js";
export type { BarcodeScannerProps } from "./components/BarcodeScanner.js";
export { ScanGuide, DEFAULT_ROI } from "./components/ScanGuide.js";
export type { ScanGuideProps, RoiRect } from "./components/ScanGuide.js";
export { ScanOverlay } from "./components/ScanOverlay.js";
export type { ScanOverlayProps } from "./components/ScanOverlay.js";
export { useBarcodeScanner } from "./hooks/useBarcodeScanner.js";
export type {
  UseBarcodeScannerOptions,
  UseBarcodeScannerResult,
} from "./hooks/useBarcodeScanner.js";
export { useCamera } from "./hooks/useCamera.js";
export type { UseCameraResult } from "./hooks/useCamera.js";
export { useElementSize } from "./hooks/useElementSize.js";
export type { ElementSize } from "./hooks/useElementSize.js";
export { objectFitRect } from "./utils/objectFit.js";
