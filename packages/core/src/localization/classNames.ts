import type { BarcodeFormat } from "../types/barcode.types.js";

/**
 * Class order for `pharma_multibarcodes.onnx` (Ultralytics YOLO26n detect).
 * Matches model metadata: `{0: Code128, 1: PDF417, 2: QRCode, 3: UPCA, 4: datamatrix}`.
 */
export const PHARMA_LOCALIZER_CLASS_NAMES = [
  "Code128",
  "PDF417",
  "QRCode",
  "UPCA",
  "datamatrix",
] as const;

export type PharmaLocalizerClassName =
  (typeof PHARMA_LOCALIZER_CLASS_NAMES)[number];

/** Map YOLO class labels (case-insensitive) → SDK barcode formats. */
const LABEL_TO_FORMAT: Record<string, BarcodeFormat> = {
  code128: "CODE_128",
  pdf417: "PDF_417",
  qrcode: "QR_CODE",
  qr: "QR_CODE",
  upca: "UPC_A",
  upc_a: "UPC_A",
  upc: "UPC_A",
  datamatrix: "DATA_MATRIX",
  data_matrix: "DATA_MATRIX",
  // Unknown / single-class fallback — try DataMatrix first in cascade.
  item: "DATA_MATRIX",
};

export function localizerLabelToFormat(
  label: string | undefined,
): BarcodeFormat | null {
  if (!label) return null;
  return LABEL_TO_FORMAT[label.trim().toLowerCase()] ?? null;
}

/** Square crops suit matrix codes; linear / PDF417 keep aspect. */
export function localizerLabelUsesSquareCrop(
  label: string | undefined,
): boolean {
  const format = localizerLabelToFormat(label);
  return format === "DATA_MATRIX" || format === "QR_CODE" || format === "AZTEC";
}

/** OpenCV bottle/DataMatrix cascade is only useful for DataMatrix ROIs. */
export function localizerLabelUsesOpencvCascade(
  label: string | undefined,
): boolean {
  return localizerLabelToFormat(label) === "DATA_MATRIX";
}

export function resolveClassLabel(
  classId: number,
  classNames: readonly string[] | undefined,
  fallback = "item",
): string {
  if (classNames && classId >= 0 && classId < classNames.length) {
    return classNames[classId]!;
  }
  if (classId >= 0 && classId < PHARMA_LOCALIZER_CLASS_NAMES.length) {
    return PHARMA_LOCALIZER_CLASS_NAMES[classId]!;
  }
  return fallback;
}
