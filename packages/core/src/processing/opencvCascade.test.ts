import { afterEach, describe, expect, it, vi } from "vitest";
import { mapCascadeGeometryToTile } from "./opencvCascade.js";
import type { BarcodeResult } from "../types/barcode.types.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("./opencvReady.js");
});

describe("decodeBarcodeWithCascade", () => {
  it("soft-fails with null hit when OpenCV is unavailable", async () => {
    vi.doMock("./opencvReady.js", () => ({
      ensureOpenCv: async () => null,
      resetOpenCvForTests: () => undefined,
    }));

    const { decodeBarcodeWithCascade } = await import("./opencvCascade.js");
    // Canvas is unused when OpenCV fails to load — pass a minimal stub.
    const canvas = { width: 64, height: 64 } as HTMLCanvasElement;
    const outcome = await decodeBarcodeWithCascade(canvas);
    expect(outcome.hit).toBeNull();
    expect(outcome.previewDataUrl).toBeUndefined();
  });
});

describe("mapCascadeGeometryToTile", () => {
  it("undoes quiet-zone padding and cubic upscale", () => {
    const result: BarcodeResult = {
      id: "DATA_MATRIX:x",
      text: "x",
      format: "DATA_MATRIX",
      points: [
        { x: 48, y: 48 },
        { x: 128, y: 48 },
        { x: 128, y: 128 },
        { x: 48, y: 128 },
      ],
      boundingBox: { x: 48, y: 48, width: 80, height: 80 },
      timestamp: 0,
    };

    const mapped = mapCascadeGeometryToTile(result, {
      scaleX: 2,
      scaleY: 2,
      quietZonePx: 24,
    });

    // tile = (cascade - 24) / 2
    expect(mapped.points?.[0]).toEqual({ x: 12, y: 12 });
    expect(mapped.points?.[2]).toEqual({ x: 52, y: 52 });
    expect(mapped.boundingBox).toEqual({
      x: 12,
      y: 12,
      width: 40,
      height: 40,
    });
  });
});
