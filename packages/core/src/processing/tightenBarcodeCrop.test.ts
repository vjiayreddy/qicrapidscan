import { describe, expect, it } from "vitest";
import {
  mapLocalRectToSource,
  symbolKindFromLabel,
  tightenContentRectFromImageData,
} from "./tightenBarcodeCrop.js";

function makeImageData(
  width: number,
  height: number,
  paint: (set: (x: number, y: number, luma: number) => void) => void,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  const set = (x: number, y: number, luma: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = luma;
    data[i + 1] = luma;
    data[i + 2] = luma;
    data[i + 3] = 255;
  };
  paint(set);
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

function paintBarcodeStrip(
  set: (x: number, y: number, luma: number) => void,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      set(x, y, x % 2 === 0 ? 15 : 245);
    }
  }
}

describe("symbolKindFromLabel", () => {
  it("maps YOLO class names to tighten strategies", () => {
    expect(symbolKindFromLabel("Code128")).toBe("linear");
    expect(symbolKindFromLabel("UPCA")).toBe("linear");
    expect(symbolKindFromLabel("datamatrix")).toBe("matrix");
    expect(symbolKindFromLabel("QRCode")).toBe("matrix");
    expect(symbolKindFromLabel("PDF417")).toBe("pdf417");
  });
});

describe("tightenContentRectFromImageData", () => {
  it("shrinks a linear ROI onto the barcode strip", () => {
    const image = makeImageData(80, 40, (set) => {
      paintBarcodeStrip(set, 8, 71, 12, 27);
    });

    const tight = tightenContentRectFromImageData(image, {
      marginPx: 2,
      symbolKind: "linear",
    });
    expect(tight).not.toBeNull();
    expect(tight!.y).toBeGreaterThanOrEqual(10);
    expect(tight!.y + tight!.height).toBeLessThanOrEqual(30);
  });

  it("drops label text above a linear barcode strip", () => {
    const image = makeImageData(120, 56, (set) => {
      for (let y = 6; y <= 14; y += 1) {
        for (let x = 18; x <= 100; x += 1) {
          if (x % 10 < 2) set(x, y, 25);
        }
      }
      paintBarcodeStrip(set, 12, 108, 24, 42);
    });

    const tight = tightenContentRectFromImageData(image, {
      marginPx: 2,
      symbolKind: "linear",
    });
    expect(tight).not.toBeNull();
    expect(tight!.y).toBeGreaterThan(16);
  });

  it("keeps a near-square crop for matrix symbols", () => {
    const image = makeImageData(80, 80, (set) => {
      // Dense DataMatrix-like block in the center.
      for (let y = 18; y <= 58; y += 1) {
        for (let x = 18; x <= 58; x += 1) {
          set(x, y, (x + y) % 3 === 0 ? 20 : 240);
        }
      }
    });

    const tight = tightenContentRectFromImageData(image, {
      marginPx: 2,
      symbolKind: "matrix",
    });
    expect(tight).not.toBeNull();
    expect(tight!.width / tight!.height).toBeGreaterThan(0.75);
    expect(tight!.width / tight!.height).toBeLessThan(1.35);
    expect(tight!.width).toBeLessThan(80);
  });

  it("returns null when the ROI has no ink", () => {
    const image = makeImageData(40, 40, () => undefined);
    expect(tightenContentRectFromImageData(image)).toBeNull();
  });
});

describe("mapLocalRectToSource", () => {
  it("offsets the local rect by the ROI origin", () => {
    expect(
      mapLocalRectToSource(
        { x: 5, y: 3, width: 20, height: 10 },
        { x: 100, y: 50, width: 80, height: 40 },
      ),
    ).toEqual({ x: 105, y: 53, width: 20, height: 10 });
  });
});
