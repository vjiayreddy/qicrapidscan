import { BarcodeError } from "../errors/BarcodeError.js";
import type { BarcodeFormat } from "../types/barcode.types.js";

/** Linear / 1D symbologies. */
export const ONE_D_FORMATS: readonly BarcodeFormat[] = [
  "EAN_8",
  "EAN_13",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "CODE_93",
  "ITF",
] as const;

/** Matrix / 2D symbologies. */
export const TWO_D_FORMATS: readonly BarcodeFormat[] = [
  "QR_CODE",
  "DATA_MATRIX",
  "PDF_417",
  "AZTEC",
] as const;

/** Every currently supported format (1D + 2D). OCR and other modes are not enabled. */
export const ALL_SUPPORTED_FORMATS: readonly BarcodeFormat[] = [
  ...ONE_D_FORMATS,
  ...TWO_D_FORMATS,
] as const;

/** Default decode set: all 1D and 2D formats for live camera and image upload. */
export const DEFAULT_FORMATS: readonly BarcodeFormat[] = ALL_SUPPORTED_FORMATS;

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
