import { describe, expect, it } from "vitest";
import {
  dedupeLocalizationRois,
  findContainingRoiIndex,
  paddedRoiRect,
  withRoiDecodeStatus,
} from "./hybridHelpers.js";

describe("withRoiDecodeStatus", () => {
  it("marks decoded when texts are present", () => {
    const roi = withRoiDecodeStatus(
      { x: 1, y: 2, width: 10, height: 10 },
      [{ text: "ABC", format: "DATA_MATRIX" }],
    );
    expect(roi.decoded).toBe(true);
    expect(roi.texts).toEqual(["ABC"]);
    expect(roi.formats).toEqual(["DATA_MATRIX"]);
  });

  it("marks not decoded when empty", () => {
    const roi = withRoiDecodeStatus(
      { x: 0, y: 0, width: 5, height: 5 },
      [],
    );
    expect(roi.decoded).toBe(false);
    expect(roi.texts).toEqual([]);
  });
});

describe("paddedRoiRect", () => {
  it("clamps padded crop to the frame", () => {
    const rect = paddedRoiRect(
      { x: 0, y: 0, width: 10, height: 10 },
      100,
      100,
      0.5,
    );
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBeGreaterThanOrEqual(10);
  });
});

describe("findContainingRoiIndex", () => {
  it("prefers the smaller containing ROI", () => {
    const idx = findContainingRoiIndex(
      { x: 15, y: 15 },
      [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 10, y: 10, width: 20, height: 20 },
      ],
    );
    expect(idx).toBe(1);
  });
});

describe("dedupeLocalizationRois", () => {
  it("keeps one ROI per decoded payload", () => {
    const rois = dedupeLocalizationRois([
      {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        score: 0.5,
        decoded: true,
        texts: ["A"],
        formats: ["DATA_MATRIX"],
      },
      {
        x: 2,
        y: 2,
        width: 40,
        height: 40,
        score: 0.9,
        decoded: true,
        texts: ["A"],
        formats: ["DATA_MATRIX"],
      },
    ]);
    expect(rois).toHaveLength(1);
    expect(rois[0]!.score).toBe(0.9);
  });
});
