/** Candidate formats — validated against the decoder before documented as supported. */
export type BarcodeFormat =
  | "EAN_8"
  | "EAN_13"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "CODE_39"
  | "CODE_93"
  | "ITF"
  | "CODABAR"
  | "QR_CODE"
  | "DATA_MATRIX"
  | "PDF_417"
  | "AZTEC";

export interface BarcodeResult {
  id: string;
  text: string;
  format: BarcodeFormat;
  rawBytes?: Uint8Array;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  points?: Array<{
    x: number;
    y: number;
  }>;
  timestamp: number;
  /**
   * Optional barcode thumbnail (data URL) when captureCrop is enabled.
   * Prefer the OpenCV enhancement frame that ZXing decoded when available;
   * otherwise a raw geometry crop from the source image.
   */
  cropDataUrl?: string;
}
