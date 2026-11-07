import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";

export interface DecodeCanvasInput {
  canvas: HTMLCanvasElement;
  /** Optional source dimensions when canvas is a scaled copy. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface DecodeRasterInput {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Scale factors when raster is a downscaled copy of a larger source. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface DecoderAdapter {
  readonly name: string;
  setFormats(formats: BarcodeFormat[]): void;
  /** Optional — ZXing TRY_HARDER (slower, more thorough). */
  setTryHarder?(value: boolean): void;
  decode(input: DecodeCanvasInput): BarcodeResult | null;
  decodeRaster?(input: DecodeRasterInput): BarcodeResult | null;
  destroy(): void;
}
