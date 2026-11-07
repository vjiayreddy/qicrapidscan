import { describe, expect, it } from "vitest";
import { scaleResultsToSource, toCornerPoints } from "./geometry.js";
import type { BarcodeResult } from "../types/barcode.types.js";

describe("geometry", () => {
  it("scales canvas-space results into source space", () => {
    const input: BarcodeResult[] = [
      {
        id: "1",
        text: "x",
        format: "QR_CODE",
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
        boundingBox: { x: 10, y: 10, width: 10, height: 10 },
        timestamp: 1,
      },
    ];

    const scaled = scaleResultsToSource(input, 100, 100, 200, 200);
    expect(scaled[0].points?.[0]).toEqual({ x: 20, y: 20 });
    expect(scaled[0].boundingBox).toEqual({
      x: 20,
      y: 20,
      width: 20,
      height: 20,
    });
  });

  it("builds a box from boundingBox when points are missing", () => {
    const corners = toCornerPoints({
      id: "1",
      text: "x",
      format: "EAN_13",
      boundingBox: { x: 5, y: 5, width: 40, height: 10 },
      timestamp: 1,
    });
    expect(corners).toEqual([
      { x: 5, y: 5 },
      { x: 45, y: 5 },
      { x: 45, y: 15 },
      { x: 5, y: 15 },
    ]);
  });
});
