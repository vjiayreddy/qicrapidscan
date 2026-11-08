import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";

vi.mock("./canvas.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./canvas.js")>();
  return {
    ...actual,
    get2dContext: (canvas: HTMLCanvasElement) => {
      const width = canvas.width || 1;
      const height = canvas.height || 1;
      return {
        imageSmoothingEnabled: false,
        drawImage: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        getImageData: () => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    },
  };
});

const {
  decodeWithFallbacks,
  mapResultFromRotation,
  mapResultFromScale,
  resizeCanvas,
  rotateCanvas,
  unrotatePoint,
} = await import("./decodePipeline.js");

function makeCanvas(width = 40, height = 30): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function hit(text = "OK"): BarcodeResult {
  return {
    id: `QR_CODE:${text}`,
    text,
    format: "QR_CODE",
    timestamp: 1,
    boundingBox: { x: 10, y: 4, width: 20, height: 12 },
    points: [
      { x: 10, y: 4 },
      { x: 30, y: 4 },
      { x: 30, y: 16 },
      { x: 10, y: 16 },
    ],
  };
}

describe("decodePipeline helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resizeCanvas scales dimensions and cleans up", () => {
    const source = makeCanvas(40, 20);
    const scaled = resizeCanvas(source, 2);
    expect(scaled.canvas.width).toBe(80);
    expect(scaled.canvas.height).toBe(40);
    scaled.cleanup();
    expect(scaled.canvas.width).toBe(0);
  });

  it("rotateCanvas swaps axes for 90°", () => {
    const source = makeCanvas(40, 20);
    const rotated = rotateCanvas(source, 90);
    expect(rotated.canvas.width).toBe(20);
    expect(rotated.canvas.height).toBe(40);
    rotated.cleanup();
  });

  it("mapResultFromScale divides geometry by scale", () => {
    const mapped = mapResultFromScale(hit(), 2);
    expect(mapped.boundingBox).toEqual({
      x: 5,
      y: 2,
      width: 10,
      height: 6,
    });
  });

  it("unrotatePoint / mapResultFromRotation round-trip 90°", () => {
    const sourceWidth = 40;
    const sourceHeight = 30;
    const rotated = { x: sourceHeight - 1 - 10, y: 5 };
    expect(unrotatePoint(rotated.x, rotated.y, 90, sourceWidth, sourceHeight)).toEqual({
      x: 5,
      y: 10,
    });

    const mapped = mapResultFromRotation(
      {
        ...hit(),
        boundingBox: { x: 19, y: 5, width: 2, height: 2 },
        points: [{ x: 19, y: 5 }],
      },
      90,
      sourceWidth,
      sourceHeight,
    );
    expect(mapped.points?.[0]).toEqual({ x: 5, y: 10 });
  });
});

describe("decodeWithFallbacks", () => {
  it("returns the direct hit without fallbacks", async () => {
    const decode = vi.fn(async () => hit("direct"));
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      setTryHarder: vi.fn(),
      decode,
      destroy: vi.fn(),
    };

    const result = await decodeWithFallbacks(decoder, makeCanvas(), {
      multiScale: true,
      rotationRetry: true,
      imageEnhancement: true,
    });

    expect(result?.text).toBe("direct");
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("tries multi-scale after a direct miss", async () => {
    let calls = 0;
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      setTryHarder: vi.fn(),
      decode: async () => {
        calls += 1;
        return calls === 2 ? hit("scaled") : null;
      },
      destroy: vi.fn(),
    };

    const result = await decodeWithFallbacks(decoder, makeCanvas(), {
      multiScale: true,
      scales: [1, 1.5, 2],
      rotationRetry: false,
      imageEnhancement: false,
      restoreTryHarder: false,
    });

    expect(result?.text).toBe("scaled");
    expect(calls).toBe(2);
    expect(decoder.setTryHarder).toHaveBeenCalledWith(true);
    expect(decoder.setTryHarder).toHaveBeenCalledWith(false);
  });

  it("enhancementOnly skips scale and rotation", async () => {
    let calls = 0;
    const decoder: DecoderAdapter = {
      name: "mock",
      setFormats: vi.fn(),
      setTryHarder: vi.fn(),
      decode: async () => {
        calls += 1;
        return calls === 1 ? hit("enhanced") : null;
      },
      destroy: vi.fn(),
    };

    const result = await decodeWithFallbacks(decoder, makeCanvas(), {
      tryDirect: false,
      enhancementOnly: true,
      imageEnhancement: true,
      restoreTryHarder: true,
    });

    expect(result?.text).toBe("enhanced");
    expect(calls).toBe(1);
  });
});
