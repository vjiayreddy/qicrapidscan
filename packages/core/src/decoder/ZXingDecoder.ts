import {
  BarcodeDetector,
  prepareZXingModule,
  type BarcodeFormat as DetectorFormat,
  type DetectedBarcode,
} from "barcode-detector/ponyfill";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import type {
  DecodeCanvasInput,
  DecodeRasterInput,
  DecoderAdapter,
} from "./DecoderAdapter.js";
import { DEFAULT_FORMATS } from "./formats.js";

/** Map SDK formats → barcode-detector / Barcode Detection API format ids. */
const TO_DETECTOR: Record<BarcodeFormat, DetectorFormat> = {
  EAN_8: "ean_8",
  EAN_13: "ean_13",
  UPC_A: "upc_a",
  UPC_E: "upc_e",
  CODE_128: "code_128",
  CODE_39: "code_39",
  CODE_93: "code_93",
  ITF: "itf",
  CODABAR: "codabar",
  QR_CODE: "qr_code",
  DATA_MATRIX: "data_matrix",
  PDF_417: "pdf417",
  AZTEC: "aztec",
};

const FROM_DETECTOR = new Map<string, BarcodeFormat>([
  ["ean_8", "EAN_8"],
  ["ean_13", "EAN_13"],
  ["upc_a", "UPC_A"],
  ["upc_e", "UPC_E"],
  ["code_128", "CODE_128"],
  ["code_39", "CODE_39"],
  ["code_93", "CODE_93"],
  ["itf", "ITF"],
  ["itf_14", "ITF"],
  ["codabar", "CODABAR"],
  ["qr_code", "QR_CODE"],
  ["qr_code_model_1", "QR_CODE"],
  ["qr_code_model_2", "QR_CODE"],
  ["micro_qr_code", "QR_CODE"],
  ["rm_qr_code", "QR_CODE"],
  ["data_matrix", "DATA_MATRIX"],
  ["pdf417", "PDF_417"],
  ["compact_pdf417", "PDF_417"],
  ["micro_pdf417", "PDF_417"],
  ["aztec", "AZTEC"],
  ["aztec_code", "AZTEC"],
  ["aztec_rune", "AZTEC"],
]);

let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = prepareZXingModule({ fireImmediately: true }).then(() => undefined);
  }
  return wasmReady;
}

function createResultId(format: BarcodeFormat, text: string): string {
  return `${format}:${text}`;
}

function mapDetected(
  detected: DetectedBarcode,
  scaleX: number,
  scaleY: number,
): BarcodeResult | null {
  const format = FROM_DETECTOR.get(detected.format);
  if (!format) return null;

  const text = detected.rawValue;
  const points = detected.cornerPoints.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));

  const box = detected.boundingBox;
  const boundingBox = {
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };

  return {
    id: createResultId(format, text),
    text,
    format,
    boundingBox,
    points,
    timestamp: Date.now(),
  };
}

/**
 * ZXing-WASM decoder via `barcode-detector` (Barcode Detection API ponyfill).
 * Loaded via dynamic import from BarcodeScanner so SSR stays clean.
 */
export class ZXingDecoder implements DecoderAdapter {
  readonly name = "zxing-wasm";
  private formats: BarcodeFormat[] = [...DEFAULT_FORMATS];
  private detector: BarcodeDetector;

  constructor(
    formats?: BarcodeFormat[],
    _tryHarder = true,
    _alsoInverted = true,
  ) {
    if (formats && formats.length > 0) {
      this.formats = [...formats];
    }
    this.detector = this.createDetector();
    void ensureWasm();
  }

  setFormats(formats: BarcodeFormat[]): void {
    this.formats = formats.length > 0 ? [...formats] : [...DEFAULT_FORMATS];
    this.detector = this.createDetector();
  }

  setTryHarder(_value: boolean): void {
    // barcode-detector uses zxing-wasm defaults (tryHarder-like behavior built-in).
  }

  setAlsoInverted(_value: boolean): void {
    // Inversion is handled inside zxing-wasm reader options of the ponyfill.
  }

  async decode(input: DecodeCanvasInput): Promise<BarcodeResult | null> {
    const all = await this.decodeAll(input);
    return all[0] ?? null;
  }

  async decodeAll(input: DecodeCanvasInput): Promise<BarcodeResult[]> {
    const { canvas, sourceWidth, sourceHeight } = input;
    const scaleX = sourceWidth && canvas.width > 0 ? sourceWidth / canvas.width : 1;
    const scaleY = sourceHeight && canvas.height > 0 ? sourceHeight / canvas.height : 1;

    await ensureWasm();
    try {
      const detected = await this.detector.detect(canvas);
      const mapped: BarcodeResult[] = [];
      const seen = new Set<string>();
      for (const item of detected) {
        const result = mapDetected(item, scaleX, scaleY);
        if (!result) continue;
        const key = `${result.format}:${result.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push(result);
      }
      return mapped;
    } catch {
      return [];
    }
  }

  async decodeRaster(input: DecodeRasterInput): Promise<BarcodeResult | null> {
    const { data, width, height, sourceWidth, sourceHeight } = input;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let rgba: Uint8ClampedArray;
    if (data.length === width * height * 4) {
      rgba = data;
    } else if (data.length === width * height) {
      rgba = new Uint8ClampedArray(width * height * 4);
      for (let i = 0, j = 0; i < data.length; i += 1, j += 4) {
        const v = data[i]!;
        rgba[j] = v;
        rgba[j + 1] = v;
        rgba[j + 2] = v;
        rgba[j + 3] = 255;
      }
    } else {
      return null;
    }

    ctx.putImageData(
      new ImageData(rgba as unknown as ImageDataArray, width, height),
      0,
      0,
    );
    try {
      return await this.decode({
        canvas,
        sourceWidth: sourceWidth ?? width,
        sourceHeight: sourceHeight ?? height,
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  destroy(): void {
    // BarcodeDetector has no dispose; drop reference.
  }

  private createDetector(): BarcodeDetector {
    return new BarcodeDetector({
      formats: this.formats.map((format) => TO_DETECTOR[format]),
    });
  }
}

export function createDefaultDecoder(
  formats?: BarcodeFormat[],
  tryHarder = true,
  alsoInverted = true,
): DecoderAdapter {
  return new ZXingDecoder(formats, tryHarder, alsoInverted);
}
