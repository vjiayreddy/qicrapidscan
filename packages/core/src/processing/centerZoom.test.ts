import { describe, expect, it } from "vitest";
import type { BarcodeResult } from "../types/barcode.types.js";
import {
  computeCenterZoomGeometry,
  mapResultsFromCenterZoom,
} from "./centerZoom.js";

describe("computeCenterZoomGeometry", () => {
  it("crops the center and upscales sizing", () => {
    const geometry = computeCenterZoomGeometry(200, 100, {
      cropRatio: 0.5,
      scale: 2,
    });

    expect(geometry.cropWidth).toBe(100);
    expect(geometry.cropHeight).toBe(50);
    expect(geometry.originX).toBe(50);
    expect(geometry.originY).toBe(25);
    expect(geometry.outWidth).toBe(200);
    expect(geometry.outHeight).toBe(100);
    expect(geometry.scale).toBe(2);
  });

  it("clamps cropRatio into [0.25, 1]", () => {
    const tiny = computeCenterZoomGeometry(100, 100, {
      cropRatio: 0.01,
      scale: 1,
    });
    expect(tiny.cropWidth).toBe(25);

    const full = computeCenterZoomGeometry(100, 100, {
      cropRatio: 2,
      scale: 1,
    });
    expect(full.cropWidth).toBe(100);
    expect(full.originX).toBe(0);
  });

  it("uses barcodesdk-compatible defaults", () => {
    const geometry = computeCenterZoomGeometry(960, 540);
    expect(geometry.cropWidth).toBe(Math.floor(960 * 0.55));
    expect(geometry.cropHeight).toBe(Math.floor(540 * 0.55));
    expect(geometry.scale).toBe(2);
    expect(geometry.outWidth).toBe(geometry.cropWidth * 2);
  });
});

describe("mapResultsFromCenterZoom", () => {
  it("maps points and boxes back into source-canvas space", () => {
    const input: BarcodeResult[] = [
      {
        id: "QR_CODE:x",
        text: "x",
        format: "QR_CODE",
        timestamp: 1,
        points: [
          { x: 20, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 30 },
          { x: 20, y: 30 },
        ],
        boundingBox: { x: 20, y: 10, width: 20, height: 20 },
      },
    ];

    const mapped = mapResultsFromCenterZoom(input, {
      originX: 50,
      originY: 25,
      scale: 2,
    });

    expect(mapped[0]?.points?.[0]).toEqual({ x: 60, y: 30 });
    expect(mapped[0]?.boundingBox).toEqual({
      x: 60,
      y: 30,
      width: 10,
      height: 10,
    });
  });
});
