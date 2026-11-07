import type { BarcodeResult } from "../types/barcode.types.js";

export type Point = { x: number; y: number };

/** Expand decoder geometry into a 4-point polygon for AR overlay. */
export function toCornerPoints(result: BarcodeResult): Point[] {
  if (result.points && result.points.length >= 4) {
    return result.points.slice(0, 4).map((point) => ({ x: point.x, y: point.y }));
  }

  if (result.boundingBox) {
    const { x, y, width, height } = result.boundingBox;
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  if (result.points && result.points.length === 2) {
    const a = result.points[0]!;
    const b = result.points[1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const pad = Math.max(6, len * 0.04);
    const nx = (-dy / len) * pad;
    const ny = (dx / len) * pad;
    return [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny },
      { x: a.x - nx, y: a.y - ny },
    ];
  }

  if (result.points && result.points.length >= 2) {
    const xs = result.points.map((p) => p.x);
    const ys = result.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
  }

  return [];
}

export function boundingBoxFromPoints(points: Point[]): BarcodeResult["boundingBox"] {
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Scale geometry from processing-canvas space into native source/video space. */
export function scaleResultsToSource(
  results: BarcodeResult[],
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): BarcodeResult[] {
  if (
    canvasWidth <= 0 ||
    canvasHeight <= 0 ||
    (canvasWidth === sourceWidth && canvasHeight === sourceHeight)
  ) {
    return results;
  }

  const scaleX = sourceWidth / canvasWidth;
  const scaleY = sourceHeight / canvasHeight;

  return results.map((result) => ({
    ...result,
    points: result.points?.map((point) => ({
      x: point.x * scaleX,
      y: point.y * scaleY,
    })),
    boundingBox: result.boundingBox
      ? {
          x: result.boundingBox.x * scaleX,
          y: result.boundingBox.y * scaleY,
          width: result.boundingBox.width * scaleX,
          height: result.boundingBox.height * scaleY,
        }
      : undefined,
  }));
}
