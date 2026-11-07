import { describe, expect, it } from "vitest";
import type { BarcodeResult } from "../types/barcode.types.js";
import { clampRegion, remapResultToSource } from "./coordinates.js";

describe("coordinates", () => {
  it("remaps points and boxes into source space", () => {
    const local: BarcodeResult = {
      id: "QR_CODE:a",
      text: "a",
      format: "QR_CODE",
      timestamp: 1,
      points: [{ x: 2, y: 3 }],
      boundingBox: { x: 1, y: 1, width: 10, height: 8 },
    };
    const mapped = remapResultToSource(local, {
      x: 100,
      y: 50,
      width: 40,
      height: 40,
      depth: 1,
    });
    expect(mapped.points?.[0]).toEqual({ x: 102, y: 53 });
    expect(mapped.boundingBox).toEqual({ x: 101, y: 51, width: 10, height: 8 });
  });

  it("clamps tiny regions to null", () => {
    expect(
      clampRegion({ x: 0, y: 0, width: 2, height: 2, depth: 0 }, 100, 100),
    ).toBeNull();
  });
});
