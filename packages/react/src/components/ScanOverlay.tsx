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
  /**
   * Draw L-shaped corner landmarks + index badges (better on dense still images).
   * Default true.
   */
  showLandmarks?: boolean;
  /** Show 1-based index badges on each detection. Default follows showLandmarks. */
  showIndices?: boolean;
}

/** Prefer smoothed corner points; fall back to AABB only when points are missing. */
function polygonPoints(result: BarcodeResult): string | null {
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

  if (result.boundingBox) {
    const { x, y, width, height } = result.boundingBox;
    const x2 = x + width;
    const y2 = y + height;
    return `${x},${y} ${x2},${y} ${x2},${y2} ${x},${y2}`;
  }

  return null;
}

function cornerPoints(
  result: BarcodeResult,
): Array<{ x: number; y: number }> | null {
  if (result.points && result.points.length >= 3) {
    return result.points.slice(0, 4).map((p) => ({ x: p.x, y: p.y }));
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
  return null;
}

/** SVG polygons / landmarks mapped from barcode geometry into the fitted media box. */
export function ScanOverlay({
  results,
  sourceWidth,
  sourceHeight,
  containerWidth,
  containerHeight,
  objectFit = "cover",
  fill = "rgba(249,115,22,0.22)",
  stroke = "#f97316",
  className,
  showLandmarks = true,
  showIndices,
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

  const minSide = Math.min(sourceWidth, sourceHeight);
  const strokeWidth = Math.max(3, minSide / 220);
  const landmarkLen = Math.max(10, minSide / 55);
  const landmarkStroke = Math.max(4, minSide / 160);
  const badgeR = Math.max(10, minSide / 70);
  const withIndices = showIndices ?? showLandmarks;

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
      {results.map((result, index) => {
        const points = polygonPoints(result);
        const corners = cornerPoints(result);
        if (!points && !corners) return null;
        const key = `${result.id}-${index}`;

        return (
          <g key={key}>
            {points ? (
              <polygon
                points={points}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
              />
            ) : null}

            {showLandmarks && corners && corners.length >= 4
              ? corners.map((corner, i) => {
                  const prev = corners[(i + corners.length - 1) % corners.length]!;
                  const next = corners[(i + 1) % corners.length]!;
                  const toPrev = unitToward(corner, prev);
                  const toNext = unitToward(corner, next);
                  const a = {
                    x: corner.x + toPrev.x * landmarkLen,
                    y: corner.y + toPrev.y * landmarkLen,
                  };
                  const b = {
                    x: corner.x + toNext.x * landmarkLen,
                    y: corner.y + toNext.y * landmarkLen,
                  };
                  return (
                    <path
                      key={`${key}-c${i}`}
                      d={`M ${a.x} ${a.y} L ${corner.x} ${corner.y} L ${b.x} ${b.y}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={landmarkStroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })
              : null}

            {withIndices && corners && corners.length > 0 ? (
              <g>
                <circle
                  cx={corners[0]!.x}
                  cy={corners[0]!.y}
                  r={badgeR}
                  fill={stroke}
                />
                <text
                  x={corners[0]!.x}
                  y={corners[0]!.y}
                  fill="#fff"
                  fontSize={badgeR * 1.1}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {index + 1}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function unitToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
