import { describe, expect, it } from "vitest";
import { ResultTracker, toTrackedDecode } from "./ResultTracker.js";
import type { BarcodeResult } from "../types/barcode.types.js";

function result(
  text: string,
  points: Array<{ x: number; y: number }>,
  timestamp = 1,
): BarcodeResult {
  return {
    id: `QR_CODE:${text}`,
    text,
    format: "QR_CODE",
    points,
    timestamp,
  };
}

describe("ResultTracker", () => {
  it("emits overlay after confirmHits and accepts once", () => {
    const tracker = new ResultTracker({
      dedupeWindowMs: 1500,
      confirmHits: 2,
      missFrames: 3,
      smooth: 0.5,
    });

    const corners = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];

    const first = tracker.ingest([toTrackedDecode(result("a", corners, 1))!]);
    expect(first.overlay).toHaveLength(0);
    expect(first.accepted).toHaveLength(0);

    const second = tracker.ingest([toTrackedDecode(result("a", corners, 2))!]);
    expect(second.overlay).toHaveLength(1);
    expect(second.accepted).toHaveLength(1);
    expect(second.overlay[0].points).toHaveLength(4);
  });

  it("keeps overlay alive across miss frames then clears", () => {
    const tracker = new ResultTracker({
      dedupeWindowMs: 1500,
      confirmHits: 1,
      missFrames: 2,
      smooth: 0.5,
    });

    const corners = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];

    expect(tracker.ingest([toTrackedDecode(result("b", corners))!]).overlay).toHaveLength(
      1,
    );
    expect(tracker.ingest([]).overlay).toHaveLength(1);
    expect(tracker.ingest([]).overlay).toHaveLength(0);
  });

  it("expands 1D two-point geometry into a polygon", () => {
    const tracked = toTrackedDecode(
      result("123", [
        { x: 0, y: 10 },
        { x: 100, y: 10 },
      ]),
    );
    expect(tracked?.cornerPoints).toHaveLength(4);
  });
});
