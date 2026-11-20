import { describe, expect, it, vi } from "vitest";

vi.mock("./canvas.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./canvas.js")>();
  return {
    ...actual,
    get2dContext: (canvas: HTMLCanvasElement) => {
      const width = canvas.width || 1;
      const height = canvas.height || 1;
      return {
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "high",
        fillStyle: "#ffffff",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: () => ({
          data: new Uint8ClampedArray(width * height * 4).fill(255),
          width,
          height,
        }),
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    },
  };
});

const { prepareBarcodeDecodeCanvas } = await import(
  "./prepareBarcodeDecodeCanvas.js"
);

function makeTile(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("prepareBarcodeDecodeCanvas", () => {
  it("upscales thin crops to min width, adds white border, then 2×", () => {
    const tile = makeTile(120, 24);
    const prepared = prepareBarcodeDecodeCanvas(tile, {
      minBarcodeWidth: 500,
      whiteBorderPx: 30,
      finalUpscale: 2,
    });
    expect(prepared).not.toBeNull();
    // Content 500 wide + 30*2 border = 560, then ×2 → 1120
    expect(prepared!.canvas.width).toBe(1120);
    expect(prepared!.canvas.height).toBe((24 * (500 / 120) + 60) * 2);
    prepared!.cleanup();
  });

  it("maps prepared points back toward tile space", () => {
    const tile = makeTile(200, 40);
    const prepared = prepareBarcodeDecodeCanvas(tile, {
      minBarcodeWidth: 200,
      whiteBorderPx: 30,
      finalUpscale: 2,
    });
    expect(prepared).not.toBeNull();
    // Content pixel (0,0) on tile → border*finalScale on final canvas.
    const local = prepared!.toTileLocal(60, 60);
    expect(local.x).toBeCloseTo(0, 0);
    expect(local.y).toBeCloseTo(0, 0);
    prepared!.cleanup();
  });
});
