"use client";

import type { BarcodeResult } from "@qicrapidscan/core";
import { objectFitRect } from "../utils/objectFit.js";

export interface ScanOverlayProps {
  results: BarcodeResult[];
  sourceWidth: number;
  sourceHeight: number;
  containerWidth: number;
  containerHeight: number;
  objectFit?: "contain" | "cover";
  fill?: string;
  stroke?: string;
  className?: string;
}

/** Prefer a stable 4-corner polygon for AR overlays (including 1D codes). */
function polygonPoints(result: BarcodeResult): string | null {
  if (result.boundingBox) {
    const { x, y, width, height } = result.boundingBox;
    const x2 = x + width;
    const y2 = y + height;
    return `${x},${y} ${x2},${y} ${x2},${y2} ${x},${y2}`;
  }

  if (result.points && result.points.length >= 3) {
    return result.points.map((point) => `${point.x},${point.y}`).join(" ");
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
      `${a.x + nx},${a.y + ny}`,
      `${b.x + nx},${b.y + ny}`,
      `${b.x - nx},${b.y - ny}`,
      `${a.x - nx},${a.y - ny}`,
    ].join(" ");
  }

  return null;
}

/** SVG polygons mapped from barcode geometry into the fitted media box. */
export function ScanOverlay({
  results,
  sourceWidth,
  sourceHeight,
  containerWidth,
  containerHeight,
  objectFit = "contain",
  fill = "rgba(34,197,94,0.18)",
  stroke = "#22c55e",
  className,
}: ScanOverlayProps) {
  const fitted = objectFitRect(
    containerWidth,
    containerHeight,
    sourceWidth,
    sourceHeight,
    objectFit,
  );

  if (!fitted || results.length === 0 || sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  const strokeWidth = Math.max(2, Math.min(sourceWidth, sourceHeight) / 180);

  return (
    <svg
      className={className}
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: fitted.left,
        top: fitted.top,
        width: fitted.width,
        height: fitted.height,
        zIndex: 3,
      }}
      viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {results.map((result) => {
        const points = polygonPoints(result);
        if (!points) return null;
        return (
          <polygon
            key={result.id}
            points={points}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
