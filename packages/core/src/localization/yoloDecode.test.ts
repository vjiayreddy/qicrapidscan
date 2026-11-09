import { describe, expect, it } from "vitest";
import { mapBoxToSource, type LetterboxMeta } from "./letterbox.js";
import { candidatesToRois, decodeYoloOutput, nms } from "./yoloDecode.js";

describe("decodeYoloOutput", () => {
  it("decodes [1,5,N] xywh + score channels", () => {
    // One strong prediction at index 0: cx=100, cy=200, w=40, h=20, score=0.9
    const numPreds = 4;
    const data = new Float32Array(5 * numPreds);
    data[0 * numPreds + 0] = 100;
    data[1 * numPreds + 0] = 200;
    data[2 * numPreds + 0] = 40;
    data[3 * numPreds + 0] = 20;
    data[4 * numPreds + 0] = 0.9;
    // Weak / below threshold
    data[4 * numPreds + 1] = 0.1;

    const cands = decodeYoloOutput(data, [1, 5, numPreds], 0.25);
    expect(cands).toHaveLength(1);
    expect(cands[0]!.score).toBeCloseTo(0.9);
    expect(cands[0]!.x1).toBeCloseTo(80);
    expect(cands[0]!.y1).toBeCloseTo(190);
    expect(cands[0]!.x2).toBeCloseTo(120);
    expect(cands[0]!.y2).toBeCloseTo(210);
  });
});

describe("nms", () => {
  it("keeps the higher-score overlapping box", () => {
    const kept = nms(
      [
        { x1: 0, y1: 0, x2: 10, y2: 10, score: 0.5 },
        { x1: 1, y1: 1, x2: 11, y2: 11, score: 0.9 },
        { x1: 50, y1: 50, x2: 60, y2: 60, score: 0.8 },
      ],
      0.45,
      10,
    );
    expect(kept).toHaveLength(2);
    expect(kept[0]!.score).toBe(0.9);
    expect(kept[1]!.score).toBe(0.8);
  });
});

describe("mapBoxToSource / candidatesToRois", () => {
  it("remaps letterbox coords back to source", () => {
    const meta: LetterboxMeta = {
      scale: 0.5,
      padX: 100,
      padY: 50,
      sourceWidth: 800,
      sourceHeight: 600,
      inputSize: 1280,
    };
    const box = mapBoxToSource({ x1: 100, y1: 50, x2: 200, y2: 150 }, meta);
    expect(box.x).toBeCloseTo(0);
    expect(box.y).toBeCloseTo(0);
    expect(box.width).toBeCloseTo(200);
    expect(box.height).toBeCloseTo(200);

    const rois = candidatesToRois(
      [{ x1: 100, y1: 50, x2: 200, y2: 150, score: 0.7 }],
      meta,
      "item",
    );
    expect(rois[0]!.label).toBe("item");
    expect(rois[0]!.score).toBe(0.7);
  });
});
