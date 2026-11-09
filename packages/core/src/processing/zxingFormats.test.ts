import { describe, expect, it } from "vitest";
import {
  cascadeZxingFormats,
  computeCascadeScaleFactor,
  fromZxingFormat,
  mapZxingReadResult,
  toZxingFormats,
} from "./zxingFormats.js";
import type { ReadResult } from "zxing-wasm/reader";

describe("toZxingFormats / fromZxingFormat", () => {
  it("maps SDK formats to zxing-wasm ids", () => {
    expect(toZxingFormats(["DATA_MATRIX", "QR_CODE"])).toEqual([
      "DataMatrix",
      "QRCode",
    ]);
    expect(fromZxingFormat("DataMatrix")).toBe("DATA_MATRIX");
    expect(fromZxingFormat("None")).toBeNull();
  });
});

describe("cascadeZxingFormats", () => {
  it("prefers DataMatrix when enabled", () => {
    expect(
      cascadeZxingFormats(["QR_CODE", "DATA_MATRIX", "CODE_128"]),
    ).toEqual(["DataMatrix"]);
  });

  it("falls back to all formats when DataMatrix is disabled", () => {
    expect(cascadeZxingFormats(["QR_CODE", "EAN_13"])).toEqual([
      "QRCode",
      "EAN13",
    ]);
  });

  it("defaults to DataMatrix when formats omitted", () => {
    expect(cascadeZxingFormats()).toEqual(["DataMatrix"]);
  });
});

describe("computeCascadeScaleFactor", () => {
  it("upscales small crops to the min target edge (capped at 4×)", () => {
    expect(computeCascadeScaleFactor(50, 80, 200)).toBeCloseTo(4);
    expect(computeCascadeScaleFactor(40, 40, 280)).toBe(4);
  });

  it("does not downscale large crops", () => {
    expect(computeCascadeScaleFactor(400, 400, 200)).toBe(1);
  });
});

describe("mapZxingReadResult", () => {
  it("maps a valid DataMatrix hit to BarcodeResult", () => {
    const read = {
      isValid: true,
      format: "DataMatrix",
      text: "010123",
      bytes: new Uint8Array([1, 2, 3]),
      position: {
        topLeft: { x: 10, y: 10 },
        topRight: { x: 50, y: 10 },
        bottomRight: { x: 50, y: 50 },
        bottomLeft: { x: 10, y: 50 },
      },
    } as unknown as ReadResult;

    const mapped = mapZxingReadResult(read);
    expect(mapped).not.toBeNull();
    expect(mapped!.format).toBe("DATA_MATRIX");
    expect(mapped!.text).toBe("010123");
    expect(mapped!.boundingBox).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    });
    expect(mapped!.rawBytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns null for invalid hits", () => {
    const read = {
      isValid: false,
      format: "None",
      text: "",
      bytes: new Uint8Array(),
      position: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 0, y: 0 },
        bottomRight: { x: 0, y: 0 },
        bottomLeft: { x: 0, y: 0 },
      },
    } as unknown as ReadResult;
    expect(mapZxingReadResult(read)).toBeNull();
  });
});
