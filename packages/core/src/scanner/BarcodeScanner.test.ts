import { describe, expect, it, vi } from "vitest";
import { BarcodeError } from "../errors/BarcodeError.js";
import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { BarcodeScanner } from "./BarcodeScanner.js";

function mockDecoder(result: BarcodeResult | null = null): DecoderAdapter {
  return {
    name: "mock",
    setFormats: vi.fn(),
    decode: vi.fn(() => result),
    destroy: vi.fn(),
  };
}

describe("BarcodeScanner (Phase 2)", () => {
  it("constructs and stores options", () => {
    const scanner = new BarcodeScanner({
      formats: ["QR_CODE"],
      detection: { multiple: true },
    });
    expect(scanner.getOptions().formats).toEqual(["QR_CODE"]);
  });

  it("rejects unsupported formats at construction", () => {
    expect(() => new BarcodeScanner({ formats: ["NOPE" as never] })).toThrow(BarcodeError);
  });

  it("rejects operations after destroy", async () => {
    const scanner = new BarcodeScanner({}, { decoder: mockDecoder() });
    await scanner.destroy();
    expect(() => scanner.pause()).toThrow(BarcodeError);
  });

  it("scanImage emits results when decoder returns a code", async () => {
    const decoded: BarcodeResult = {
      id: "QR_CODE:hello",
      text: "hello",
      format: "QR_CODE",
      timestamp: 1,
    };
    const decoder = mockDecoder(decoded);
    const scanner = new BarcodeScanner({ formats: ["QR_CODE"] }, { decoder });
    const onResult = vi.fn();
    scanner.on("result", onResult);

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;

    const results = await scanner.scanImage(canvas);
    expect(results).toEqual([decoded]);
    expect(onResult).toHaveBeenCalledWith([decoded]);
    expect(decoder.decode).toHaveBeenCalled();

    await scanner.destroy();
  });

  it("scanImage returns empty array without emitting when nothing found", async () => {
    const decoder = mockDecoder(null);
    const scanner = new BarcodeScanner({ formats: ["QR_CODE"] }, { decoder });
    const onResult = vi.fn();
    scanner.on("result", onResult);

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;

    const results = await scanner.scanImage(canvas);
    expect(results).toEqual([]);
    expect(onResult).not.toHaveBeenCalled();
    await scanner.destroy();
  });

  it("destroy is idempotent", async () => {
    const scanner = new BarcodeScanner({}, { decoder: mockDecoder() });
    await scanner.destroy();
    await scanner.destroy();
  });
});
