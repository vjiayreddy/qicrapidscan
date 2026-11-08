import type { Region } from "./types.js";
import { clampRegion } from "./coordinates.js";

export interface TileOptions {
  sourceWidth: number;
  sourceHeight: number;
  /** Target number of tile slots remaining (excluding full-frame). */
  maxTiles: number;
  overlap: number;
  depth: number;
}

/**
 * Build an overlapping grid of large regions.
 * Guarantees tile dimensions stay large enough for typical barcode crops.
 */
export function createOverlappingTiles(options: TileOptions): Region[] {
  const { sourceWidth, sourceHeight, maxTiles, overlap, depth } = options;
  if (maxTiles <= 0) return [];

  const overlapClamped = Math.min(Math.max(overlap, 0), 0.45);
  const minSide = Math.min(sourceWidth, sourceHeight);
  // Allow denser grids for tray / pack photos (was ~45% → only ~2×2 tiles).
  const minTile = Math.min(minSide, Math.max(160, Math.floor(minSide * 0.28)));

  // Largest grid whose tile (with overlap) still meets minTile.
  let cols = 1;
  let rows = 1;
  while (cols + 1 <= maxTiles) {
    const nextCols = cols + 1;
    const tileW = Math.min(sourceWidth, (sourceWidth / nextCols) * (1 + overlapClamped));
    if (tileW + 1e-6 < minTile) break;
    cols = nextCols;
  }
  while (cols * (rows + 1) <= maxTiles) {
    const nextRows = rows + 1;
    const tileH = Math.min(sourceHeight, (sourceHeight / nextRows) * (1 + overlapClamped));
    if (tileH + 1e-6 < minTile) break;
    rows = nextRows;
  }

  // Prefer at least a 2-split on the longer axis when space allows.
  if (cols === 1 && rows === 1 && maxTiles >= 2) {
    if (sourceWidth >= sourceHeight) {
      const tileW = Math.min(sourceWidth, (sourceWidth / 2) * (1 + overlapClamped));
      if (tileW >= Math.min(minTile, sourceWidth * 0.5)) cols = 2;
    } else {
      const tileH = Math.min(sourceHeight, (sourceHeight / 2) * (1 + overlapClamped));
      if (tileH >= Math.min(minTile, sourceHeight * 0.5)) rows = 2;
    }
  }

  const strideX = sourceWidth / cols;
  const strideY = sourceHeight / rows;
  const tileW = Math.min(sourceWidth, strideX * (1 + overlapClamped));
  const tileH = Math.min(sourceHeight, strideY * (1 + overlapClamped));

  const regions: Region[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (regions.length >= maxTiles) break;
      const x = col * strideX - (col > 0 ? (tileW - strideX) / 2 : 0);
      const y = row * strideY - (row > 0 ? (tileH - strideY) / 2 : 0);
      const clamped = clampRegion(
        { x, y, width: tileW, height: tileH, depth },
        sourceWidth,
        sourceHeight,
      );
      if (clamped) regions.push(clamped);
    }
  }
  return regions;
}

/**
 * Subdivide a parent region into up to 4 quadrants (recursive depth step).
 */
export function subdivideRegion(
  parent: Region,
  sourceWidth: number,
  sourceHeight: number,
): Region[] {
  const halfW = parent.width / 2;
  const halfH = parent.height / 2;
  if (halfW < 64 || halfH < 64) return [];

  const depth = parent.depth + 1;
  const candidates: Region[] = [
    { x: parent.x, y: parent.y, width: halfW, height: halfH, depth },
    { x: parent.x + halfW, y: parent.y, width: halfW, height: halfH, depth },
    { x: parent.x, y: parent.y + halfH, width: halfW, height: halfH, depth },
    {
      x: parent.x + halfW,
      y: parent.y + halfH,
      width: halfW,
      height: halfH,
      depth,
    },
  ];

  return candidates
    .map((region) => clampRegion(region, sourceWidth, sourceHeight))
    .filter((region): region is Region => region !== null);
}

/** Expand a decoded barcode box slightly so nearby tiles can avoid re-scanning it. */
export function exclusionFromResultBox(
  box: { x: number; y: number; width: number; height: number },
  padRatio = 0.15,
): { x: number; y: number; width: number; height: number } {
  const padX = box.width * padRatio;
  const padY = box.height * padRatio;
  return {
    x: box.x - padX,
    y: box.y - padY,
    width: box.width + padX * 2,
    height: box.height + padY * 2,
  };
}

export function regionMostlyExcluded(
  region: Region,
  exclusions: Array<{ x: number; y: number; width: number; height: number }>,
  coverageThreshold = 0.85,
): boolean {
  if (exclusions.length === 0) return false;
  const area = region.width * region.height;
  if (area <= 0) return true;

  let covered = 0;
  for (const box of exclusions) {
    const x1 = Math.max(region.x, box.x);
    const y1 = Math.max(region.y, box.y);
    const x2 = Math.min(region.x + region.width, box.x + box.width);
    const y2 = Math.min(region.y + region.height, box.y + box.height);
    covered += Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  }
  return covered / area >= coverageThreshold;
}
