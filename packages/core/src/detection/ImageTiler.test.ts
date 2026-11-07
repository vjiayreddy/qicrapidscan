import { describe, expect, it } from "vitest";
import {
  createOverlappingTiles,
  regionMostlyExcluded,
  subdivideRegion,
} from "./ImageTiler.js";

describe("ImageTiler", () => {
  it("creates a bounded overlapping grid", () => {
    const tiles = createOverlappingTiles({
      sourceWidth: 200,
      sourceHeight: 200,
      maxTiles: 4,
      overlap: 0.2,
      depth: 1,
    });
    expect(tiles.length).toBeLessThanOrEqual(4);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.width).toBeGreaterThan(0);
      expect(tile.height).toBeGreaterThan(0);
      expect(tile.depth).toBe(1);
    }
  });

  it("subdivides into up to four children", () => {
    const children = subdivideRegion(
      { x: 0, y: 0, width: 200, height: 200, depth: 0 },
      200,
      200,
    );
    expect(children.length).toBe(4);
    expect(children.every((c) => c.depth === 1)).toBe(true);
  });

  it("detects mostly excluded regions", () => {
    expect(
      regionMostlyExcluded(
        { x: 0, y: 0, width: 100, height: 100, depth: 0 },
        [{ x: 0, y: 0, width: 100, height: 100 }],
      ),
    ).toBe(true);
  });
});
