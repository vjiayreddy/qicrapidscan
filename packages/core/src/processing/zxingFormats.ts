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
 * Formats for the OpenCV/zxing cascade.
 * When a single ROI-hinted format is passed, use it. When multiple formats
 * include DataMatrix (legacy full-set callers), prefer DataMatrix-only.
 */
export function cascadeZxingFormats(
  formats?: readonly BarcodeFormat[],
): ReadInputBarcodeFormat[] {
  if (!formats || formats.length === 0) {
    return ["DataMatrix"];
  }
  if (formats.length === 1) {
    return toZxingFormats(formats);
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

  const position = result.position;
  if (
    !position?.topLeft ||
    !position.topRight ||
    !position.bottomRight ||
    !position.bottomLeft
  ) {
    return {
      id: `${format}:${result.text}`,
      text: result.text,
      format,
      rawBytes:
        result.bytes && result.bytes.length > 0 ? result.bytes : undefined,
      boundingBox: { x: offsetX, y: offsetY, width: 1, height: 1 },
      points: [],
      timestamp: Date.now(),
    };
  }

  const points = [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft,
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

  const bytes = result.bytes;
  return {
    id: `${format}:${result.text}`,
    text: result.text,
    format,
    rawBytes: bytes && bytes.length > 0 ? bytes : undefined,
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

/**
 * Direct zxing-wasm decode on a canvas (tryHarder + rotate + invert).
 * Upscales thin ROI crops; downscales huge full-frames for reliability.
 */
export async function decodeCanvasWithZxing(
  canvas: HTMLCanvasElement,
  formats?: readonly BarcodeFormat[],
): Promise<BarcodeResult[]> {
  if (typeof document === "undefined") return [];
  if (canvas.width < 2 || canvas.height < 2) return [];

  const { readBarcodesFromImageData } = await import("zxing-wasm/reader");

  const shortEdge = Math.min(canvas.width, canvas.height);
  const longEdge = Math.max(canvas.width, canvas.height);
  let scale = 1;
  if (shortEdge > 0 && shortEdge < 128) {
    scale = Math.min(5, 128 / shortEdge);
  } else if (longEdge > 1600) {
    // Full-frame shipping photos: keep ZXing in a workable budget.
    scale = 1600 / longEdge;
  }

  let source = canvas;
  let owned: HTMLCanvasElement | null = null;
  if (Math.abs(scale - 1) > 0.01) {
    owned = document.createElement("canvas");
    owned.width = Math.max(1, Math.round(canvas.width * scale));
    owned.height = Math.max(1, Math.round(canvas.height * scale));
    const octx = owned.getContext("2d");
    if (!octx) return [];
    octx.imageSmoothingEnabled = scale > 1;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, 0, 0, owned.width, owned.height);
    source = owned;
  }

  try {
    const sctx =
      source.getContext("2d", { willReadFrequently: true }) ??
      source.getContext("2d");
    if (!sctx) return [];
    const imageData = sctx.getImageData(0, 0, source.width, source.height);
    const zxingFormats =
      formats && formats.length > 0 ? toZxingFormats(formats) : undefined;
    const reads =
      (await readBarcodesFromImageData(imageData, {
        formats: zxingFormats,
        tryHarder: true,
        tryRotate: true,
        tryInvert: true,
        tryDownscale: true,
        tryDenoise: true,
        maxNumberOfSymbols: 16,
      })) ?? [];

    const mapped: BarcodeResult[] = [];
    const seen = new Set<string>();
    const invScale = 1 / scale;
    for (const read of Array.isArray(reads) ? reads : []) {
      const result = mapZxingReadResult(read, {
        scaleX: invScale,
        scaleY: invScale,
      });
      if (!result) continue;
      const key = `${result.format}:${result.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mapped.push(result);
    }
    return mapped;
  } finally {
    if (owned) {
      owned.width = 0;
      owned.height = 0;
    }
  }
}
