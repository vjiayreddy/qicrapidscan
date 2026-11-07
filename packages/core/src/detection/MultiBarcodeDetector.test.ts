import { describe, expect, it, vi } from "vitest";
import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { detectMultipleFromRaster } from "./RasterMultiDetect.js";

function blankRaster(width = 120, height = 120) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(255),
  };
}

describe("detectMultipleFromRaster (Phase 3)", () => {
  it("respects maxRegions bound", () => {
    let calls = 0;
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      decode: () => null,
      decodeRaster: () => {
        calls += 1;
        return null;
      },
      destroy: vi.fn(),
    };

    const outcome = detectMultipleFromRaster(decoder, blankRaster(), {
      maxResults: 5,
      maxRegions: 3,
      maxDepth: 2,
      overlap: 0.2,
      maxTimeMs: 1000,
    });

    expect(outcome.stats.regionsScanned).toBeLessThanOrEqual(3);
    expect(calls).toBeLessThanOrEqual(3);
  });

  it("collects multiple distinct codes from a scripted decoder", () => {
    const payloads = ["A", "B", "C"];
    let i = 0;
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      decode: () => null,
      decodeRaster: () => {
        const text = payloads[i];
        if (!text) return null;
        i += 1;
        return {
          id: `QR_CODE:${text}`,
          text,
          format: "QR_CODE",
          timestamp: Date.now(),
          boundingBox: { x: 5, y: 5, width: 20, height: 20 },
          points: [
            { x: 5, y: 5 },
            { x: 25, y: 5 },
            { x: 25, y: 25 },
            { x: 5, y: 25 },
          ],
        };
      },
      destroy: vi.fn(),
    };

    const outcome = detectMultipleFromRaster(decoder, blankRaster(200, 200), {
      maxResults: 10,
      maxRegions: 8,
      maxDepth: 2,
      overlap: 0.2,
      maxTimeMs: 1000,
    });

    expect(outcome.results.length).toBeGreaterThanOrEqual(2);
    expect(new Set(outcome.results.map((r) => r.text)).has("A")).toBe(true);
  });

  it("stops at maxResults", () => {
    let n = 0;
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      decode: () => null,
      decodeRaster: () => {
        n += 1;
        const text = `T${n}`;
        return {
          id: `QR_CODE:${text}`,
          text,
          format: "QR_CODE",
          timestamp: 1,
          boundingBox: { x: n * 5, y: n * 5, width: 10, height: 10 },
        };
      },
      destroy: vi.fn(),
    };

    const outcome = detectMultipleFromRaster(decoder, blankRaster(240, 240), {
      maxResults: 2,
      maxRegions: 20,
      maxDepth: 2,
      overlap: 0.1,
      maxTimeMs: 1000,
    });

    expect(outcome.results.length).toBeLessThanOrEqual(2);
    expect(outcome.stats.stoppedReason).toBe("maxResults");
  });
});
