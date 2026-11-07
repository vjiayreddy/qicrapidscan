import { BarcodeError } from "../errors/BarcodeError.js";
import type { BarcodeFormat } from "../types/barcode.types.js";

export const DEFAULT_FORMATS: readonly BarcodeFormat[] = [
  "QR_CODE",
  "EAN_13",
  "CODE_128",
  "DATA_MATRIX",
] as const;

export const ALL_SUPPORTED_FORMATS: readonly BarcodeFormat[] = [
  "EAN_8",
  "EAN_13",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "CODE_93",
  "ITF",
  "QR_CODE",
  "DATA_MATRIX",
  "PDF_417",
  "AZTEC",
] as const;

const SUPPORTED = new Set<string>(ALL_SUPPORTED_FORMATS);

export function assertSupportedFormats(formats: BarcodeFormat[]): void {
  for (const format of formats) {
    if (!SUPPORTED.has(format)) {
      throw new BarcodeError(
        "UNSUPPORTED_FORMAT",
        `Barcode format "${String(format)}" is not supported.`,
      );
    }
  }
}
