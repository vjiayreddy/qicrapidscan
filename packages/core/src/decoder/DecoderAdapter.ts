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
  /** Optional — thorough decode (engine-dependent). */
  setTryHarder?(value: boolean): void;
  /** Optional — inverted luminance attempts (engine-dependent). */
  setAlsoInverted?(value: boolean): void;
  /** Decode at most one barcode from a canvas. */
  decode(input: DecodeCanvasInput): Promise<BarcodeResult | null>;
  /**
   * Decode every barcode the engine can find in one pass.
   * Preferred for still-image multi-detect (zxing-wasm / barcode-detector).
   */
  decodeAll?(input: DecodeCanvasInput): Promise<BarcodeResult[]>;
  decodeRaster?(input: DecodeRasterInput): Promise<BarcodeResult | null>;
  destroy(): void;
}
