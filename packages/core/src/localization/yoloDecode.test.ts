import { describe, expect, it } from "vitest";
import { mapBoxToSource, type LetterboxMeta } from "./letterbox.js";
import { PHARMA_LOCALIZER_CLASS_NAMES } from "./classNames.js";
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
    expect(cands[0]!.classId).toBe(0);
    expect(cands[0]!.x1).toBeCloseTo(80);
    expect(cands[0]!.y1).toBeCloseTo(190);
    expect(cands[0]!.x2).toBeCloseTo(120);
    expect(cands[0]!.y2).toBeCloseTo(210);
  });

  it("picks argmax class for multi-class [1,9,N] pharma head", () => {
    const numPreds = 2;
    const channels = 9; // 4 box + 5 classes
    const data = new Float32Array(channels * numPreds);
    // pred 0: datamatrix (class 4) wins
    data[0 * numPreds + 0] = 50;
    data[1 * numPreds + 0] = 50;
    data[2 * numPreds + 0] = 20;
    data[3 * numPreds + 0] = 20;
    data[4 * numPreds + 0] = 0.1; // Code128
    data[5 * numPreds + 0] = 0.2; // PDF417
    data[6 * numPreds + 0] = 0.15; // QRCode
    data[7 * numPreds + 0] = 0.05; // UPCA
    data[8 * numPreds + 0] = 0.91; // datamatrix
    // pred 1: Code128 wins
    data[0 * numPreds + 1] = 200;
    data[1 * numPreds + 1] = 80;
    data[2 * numPreds + 1] = 60;
    data[3 * numPreds + 1] = 16;
    data[4 * numPreds + 1] = 0.88;
    data[5 * numPreds + 1] = 0.1;
    data[6 * numPreds + 1] = 0.1;
    data[7 * numPreds + 1] = 0.1;
    data[8 * numPreds + 1] = 0.1;

    const cands = decodeYoloOutput(data, [1, 9, numPreds], 0.25);
    expect(cands).toHaveLength(2);
    const byScore = [...cands].sort((a, b) => b.score - a.score);
    expect(byScore[0]!.classId).toBe(4);
    expect(byScore[0]!.score).toBeCloseTo(0.91);
    expect(byScore[1]!.classId).toBe(0);
    expect(byScore[1]!.score).toBeCloseTo(0.88);
  });
});

describe("nms", () => {
  it("keeps the higher-score overlapping box", () => {
    const kept = nms(
      [
        { x1: 0, y1: 0, x2: 10, y2: 10, score: 0.5, classId: 0 },
        { x1: 1, y1: 1, x2: 11, y2: 11, score: 0.9, classId: 1 },
        { x1: 50, y1: 50, x2: 60, y2: 60, score: 0.8, classId: 2 },
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
  it("remaps letterbox coords and applies pharma class names", () => {
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
      [{ x1: 100, y1: 50, x2: 200, y2: 150, score: 0.7, classId: 2 }],
      meta,
      PHARMA_LOCALIZER_CLASS_NAMES,
    );
    expect(rois[0]!.label).toBe("QRCode");
    expect(rois[0]!.classId).toBe(2);
    expect(rois[0]!.score).toBe(0.7);
  });
});
