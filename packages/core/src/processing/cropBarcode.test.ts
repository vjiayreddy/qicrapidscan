import { describe, expect, it } from "vitest";
import {
  computeCropRect,
  enhanceCropPixels,
  softenCropPixels,
} from "./cropBarcode.js";

describe("computeCropRect", () => {
  it("builds a tight square around the barcode center", () => {
    const rect = computeCropRect(
      { x: 40, y: 30, width: 80, height: 40 },
      320,
      240,
      0.06,
      true,
    );

    expect(rect.width).toBe(rect.height);
    // max(80,40) * 1.12 ≈ 89.6
    expect(rect.width).toBeGreaterThanOrEqual(80);
    expect(rect.width).toBeLessThanOrEqual(100);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(320);
    expect(rect.y + rect.height).toBeLessThanOrEqual(240);
  });

  it("clamps near frame edges without overflowing", () => {
    const rect = computeCropRect(
      { x: 0, y: 0, width: 30, height: 30 },
      100,
      80,
      0.1,
      true,
    );
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(100);
    expect(rect.y + rect.height).toBeLessThanOrEqual(80);
  });

  it("can keep a non-square padded rect", () => {
    const rect = computeCropRect(
      { x: 10, y: 10, width: 100, height: 40 },
      400,
      300,
      0.05,
      false,
    );
    expect(rect.width).toBeGreaterThan(rect.height);
  });
});

describe("enhanceCropPixels", () => {
  it("converts color pixels to grayscale", () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, // red
      0, 255, 0, 255, // green
    ]);
    enhanceCropPixels(data, { grayscale: true, contrast: 1 });
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
    expect(data[4]).toBe(data[5]);
    expect(data[5]).toBe(data[6]);
    // green luma > red luma
    expect(data[4]!).toBeGreaterThan(data[0]!);
  });

  it("boosts contrast away from mid-gray", () => {
    const data = new Uint8ClampedArray([
      64, 64, 64, 255,
      192, 192, 192, 255,
    ]);
    enhanceCropPixels(data, { grayscale: false, contrast: 1.5 });
    expect(data[0]!).toBeLessThan(64);
    expect(data[4]!).toBeGreaterThan(192);
  });
});

describe("softenCropPixels", () => {
  it("blurs interior pixels toward neighbors", () => {
    const width = 5;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4);
    // White center, black elsewhere
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const center = ((2 * width + 2) * 4);
    data[center] = 255;
    data[center + 1] = 255;
    data[center + 2] = 255;

    softenCropPixels(data, width, height);
    expect(data[center]!).toBeLessThan(255);
    expect(data[center]!).toBeGreaterThan(0);
  });
});
