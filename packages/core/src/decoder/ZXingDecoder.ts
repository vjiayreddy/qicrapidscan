import {
  BarcodeFormat as ZXingBarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
  type Result,
} from "@zxing/library";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import type {
  DecodeCanvasInput,
  DecodeRasterInput,
  DecoderAdapter,
} from "./DecoderAdapter.js";
import { DEFAULT_FORMATS } from "./formats.js";

const TO_ZXING: Record<BarcodeFormat, ZXingBarcodeFormat> = {
  EAN_8: ZXingBarcodeFormat.EAN_8,
  EAN_13: ZXingBarcodeFormat.EAN_13,
  UPC_A: ZXingBarcodeFormat.UPC_A,
  UPC_E: ZXingBarcodeFormat.UPC_E,
  CODE_128: ZXingBarcodeFormat.CODE_128,
  CODE_39: ZXingBarcodeFormat.CODE_39,
  CODE_93: ZXingBarcodeFormat.CODE_93,
  ITF: ZXingBarcodeFormat.ITF,
  QR_CODE: ZXingBarcodeFormat.QR_CODE,
  DATA_MATRIX: ZXingBarcodeFormat.DATA_MATRIX,
  PDF_417: ZXingBarcodeFormat.PDF_417,
  AZTEC: ZXingBarcodeFormat.AZTEC,
};

const FROM_ZXING = new Map<ZXingBarcodeFormat, BarcodeFormat>(
  (Object.entries(TO_ZXING) as Array<[BarcodeFormat, ZXingBarcodeFormat]>).map(
    ([format, zxing]) => [zxing, format],
  ),
);

function createResultId(format: BarcodeFormat, text: string): string {
  return `${format}:${text}`;
}

function mapResult(
  result: Result,
  scaleX: number,
  scaleY: number,
): BarcodeResult | null {
  const format = FROM_ZXING.get(result.getBarcodeFormat());
  if (!format) {
    return null;
  }

  const text = result.getText();
  const rawBytes = result.getRawBytes() ?? undefined;
  const resultPoints = result.getResultPoints() ?? [];

  const points = resultPoints
    .filter((point): point is NonNullable<typeof point> => point != null)
    .map((point) => ({
      x: point.getX() * scaleX,
      y: point.getY() * scaleY,
    }));

  let boundingBox: BarcodeResult["boundingBox"];
  if (points.length >= 2) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  return {
    id: createResultId(format, text),
    text,
    format,
    rawBytes: rawBytes ? Uint8Array.from(rawBytes) : undefined,
    boundingBox,
    points: points.length > 0 ? points : undefined,
    timestamp: Date.now(),
  };
}

/**
 * ZXing-backed decoder. Loaded via dynamic import from BarcodeScanner
 * so SSR consumers do not pull ZXing at module evaluation time.
 */
export class ZXingDecoder implements DecoderAdapter {
  readonly name = "zxing";
  private readonly reader = new MultiFormatReader();
  private formats: BarcodeFormat[] = [...DEFAULT_FORMATS];
  private tryHarder = false;

  constructor(formats?: BarcodeFormat[], tryHarder = false) {
    this.tryHarder = tryHarder;
    if (formats && formats.length > 0) {
      this.setFormats(formats);
    } else {
      this.applyHints();
    }
  }

  setFormats(formats: BarcodeFormat[]): void {
    this.formats = formats.length > 0 ? [...formats] : [...DEFAULT_FORMATS];
    this.applyHints();
  }

  setTryHarder(value: boolean): void {
    this.tryHarder = value;
    this.applyHints();
  }

  decode(input: DecodeCanvasInput): BarcodeResult | null {
    const { canvas, sourceWidth, sourceHeight } = input;
    const scaleX = sourceWidth && canvas.width > 0 ? sourceWidth / canvas.width : 1;
    const scaleY = sourceHeight && canvas.height > 0 ? sourceHeight / canvas.height : 1;

    try {
      const luminance = new HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
      return this.decodeBitmap(bitmap, scaleX, scaleY);
    } catch (error) {
      return this.handleDecodeError(error);
    }
  }

  decodeRaster(input: DecodeRasterInput): BarcodeResult | null {
    const { data, width, height, sourceWidth, sourceHeight } = input;
    const scaleX = sourceWidth && width > 0 ? sourceWidth / width : 1;
    const scaleY = sourceHeight && height > 0 ? sourceHeight / height : 1;

    try {
      // @zxing/library RGBLuminanceSource decodes greyscale reliably;
      // RGBA buffers often fail NotFound even for clear codes.
      const greyscale = toGreyscaleLuminance(data, width, height);
      const luminance = new RGBLuminanceSource(greyscale, width, height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
      return this.decodeBitmap(bitmap, scaleX, scaleY);
    } catch (error) {
      return this.handleDecodeError(error);
    }
  }

  destroy(): void {
    this.reader.reset();
  }

  private decodeBitmap(
    bitmap: BinaryBitmap,
    scaleX: number,
    scaleY: number,
  ): BarcodeResult | null {
    try {
      const result = this.reader.decodeWithState(bitmap);
      this.reader.reset();
      return mapResult(result, scaleX, scaleY);
    } catch (error) {
      this.reader.reset();
      return this.handleDecodeError(error);
    }
  }

  private handleDecodeError(error: unknown): null {
    if (error instanceof NotFoundException) {
      return null;
    }
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name: string }).name === "NotFoundException"
    ) {
      return null;
    }
    throw error;
  }

  private applyHints(): void {
    const hints = new Map();
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      this.formats.map((format) => TO_ZXING[format]),
    );
    hints.set(DecodeHintType.TRY_HARDER, this.tryHarder);
    this.reader.setHints(hints);
  }
}

function toGreyscaleLuminance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const expectedRgba = width * height * 4;
  if (data.length === width * height) {
    return data;
  }
  if (data.length < expectedRgba) {
    return data;
  }

  const greyscale = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < greyscale.length; i += 4, j += 1) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    // Rec. 601 luma
    greyscale[j] = (r * 77 + g * 150 + b * 29) >> 8;
  }
  return greyscale;
}

export function createDefaultDecoder(
  formats?: BarcodeFormat[],
  tryHarder = false,
): DecoderAdapter {
  return new ZXingDecoder(formats, tryHarder);
}
