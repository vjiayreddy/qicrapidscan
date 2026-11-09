import type {
  ReadInputBarcodeFormat,
  ReadOutputBarcodeFormat,
  ReadResult,
} from "zxing-wasm/reader";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";

const TO_ZXING: Record<BarcodeFormat, ReadInputBarcodeFormat> = {
  EAN_8: "EAN8",
  EAN_13: "EAN13",
  UPC_A: "UPCA",
  UPC_E: "UPCE",
  CODE_128: "Code128",
  CODE_39: "Code39",
  CODE_93: "Code93",
  ITF: "ITF",
  CODABAR: "Codabar",
  QR_CODE: "QRCode",
  DATA_MATRIX: "DataMatrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

const FROM_ZXING = new Map<string, BarcodeFormat>([
  ["EAN8", "EAN_8"],
  ["EAN13", "EAN_13"],
  ["UPCA", "UPC_A"],
  ["UPCE", "UPC_E"],
  ["Code128", "CODE_128"],
  ["Code39", "CODE_39"],
  ["Code93", "CODE_93"],
  ["ITF", "ITF"],
  ["ITF14", "ITF"],
  ["Codabar", "CODABAR"],
  ["QRCode", "QR_CODE"],
  ["QRCodeModel1", "QR_CODE"],
  ["QRCodeModel2", "QR_CODE"],
  ["MicroQRCode", "QR_CODE"],
  ["RMQRCode", "QR_CODE"],
  ["DataMatrix", "DATA_MATRIX"],
  ["PDF417", "PDF_417"],
  ["CompactPDF417", "PDF_417"],
  ["MicroPDF417", "PDF_417"],
  ["Aztec", "AZTEC"],
  ["AztecCode", "AZTEC"],
  ["AztecRune", "AZTEC"],
]);

export function toZxingFormats(
  formats: readonly BarcodeFormat[],
): ReadInputBarcodeFormat[] {
  const mapped = formats.map((format) => TO_ZXING[format]);
  return [...new Set(mapped)];
}

export function fromZxingFormat(
  format: ReadOutputBarcodeFormat | ReadInputBarcodeFormat | "None",
): BarcodeFormat | null {
  if (format === "None") return null;
  return FROM_ZXING.get(format) ?? null;
}

/**
 * Prefer DataMatrix-only when that format is enabled — YOLO crops are almost
 * always DataMatrix for this product path. Otherwise pass the full enabled set.
 */
export function cascadeZxingFormats(
  formats?: readonly BarcodeFormat[],
): ReadInputBarcodeFormat[] {
  if (!formats || formats.length === 0) {
    return ["DataMatrix"];
  }
  if (formats.includes("DATA_MATRIX")) {
    return ["DataMatrix"];
  }
  return toZxingFormats(formats);
}

export function mapZxingReadResult(
  result: ReadResult,
  options: { scaleX?: number; scaleY?: number; offsetX?: number; offsetY?: number } = {},
): BarcodeResult | null {
  if (!result.isValid || result.format === "None" || !result.text) {
    return null;
  }
  const format = fromZxingFormat(result.format);
  if (!format) return null;

  const scaleX = options.scaleX ?? 1;
  const scaleY = options.scaleY ?? 1;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;

  const points = [
    result.position.topLeft,
    result.position.topRight,
    result.position.bottomRight,
    result.position.bottomLeft,
  ].map((point) => ({
    x: point.x * scaleX + offsetX,
    y: point.y * scaleY + offsetY,
  }));

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    id: `${format}:${result.text}`,
    text: result.text,
    format,
    rawBytes: result.bytes.length > 0 ? result.bytes : undefined,
    boundingBox: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    },
    points,
    timestamp: Date.now(),
  };
}

/**
 * Target min edge after cubic upscale for DataMatrix grid sampling.
 * Clamped to [1, maxScale] so small bottle crops get ~2×–4× without
 * exploding very tiny ROIs past the decoder budget.
 */
export function computeCascadeScaleFactor(
  width: number,
  height: number,
  minTargetSize = 280,
  maxScale = 4,
): number {
  const edge = Math.min(width, height);
  if (edge <= 0) return 1;
  const raw = Math.max(1, minTargetSize / edge);
  return Math.min(Math.max(1, maxScale), raw);
}
