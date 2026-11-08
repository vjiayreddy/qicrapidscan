import type { BarcodeResult } from "../types/barcode.types.js";
import { toCornerPoints } from "../detection/geometry.js";
import { get2dContext } from "./canvas.js";

export type AnnotateSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement;

export interface AnnotateBarcodeImageOptions {
  /** Polygon / landmark stroke. Default `#f97316`. */
  stroke?: string;
  /** Polygon fill. Default `rgba(249,115,22,0.22)`. */
  fill?: string;
  /** Draw L-shaped corner landmarks. Default true. */
  showLandmarks?: boolean;
  /** Draw 1-based index badges. Default true. */
  showIndices?: boolean;
  /** Output MIME type. Default `image/jpeg`. */
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  /** JPEG/WebP quality 0–1. Default 0.92. */
  quality?: number;
  /**
   * Max long edge of the output (keeps huge phone photos manageable).
   * Default 2048. Pass 0 to keep full resolution.
   */
  maxEdge?: number;
}

function sourceSize(source: AnnotateSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return { width: source.width, height: source.height };
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

/**
 * Bake detection landmarks into a still image and return a data URL.
 * Used for “result image” previews (markings permanently drawn on the photo).
 */
export function annotateBarcodeImage(
  source: AnnotateSource,
  results: readonly BarcodeResult[],
  options: AnnotateBarcodeImageOptions = {},
): string | null {
  if (typeof document === "undefined") return null;

  const { width: srcW, height: srcH } = sourceSize(source);
  if (!srcW || !srcH) return null;

  const maxEdge = options.maxEdge ?? 2048;
  const scale =
    maxEdge > 0 ? Math.min(1, maxEdge / Math.max(srcW, srcH)) : 1;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  if (results.length === 0) {
    try {
      return canvas.toDataURL(
        options.mimeType ?? "image/jpeg",
        options.quality ?? 0.92,
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  const stroke = options.stroke ?? "#f97316";
  const fill = options.fill ?? "rgba(249,115,22,0.22)";
  const showLandmarks = options.showLandmarks ?? true;
  const showIndices = options.showIndices ?? true;
  const minSide = Math.min(width, height);
  const strokeWidth = Math.max(2, minSide / 220);
  const landmarkLen = Math.max(8, minSide / 55);
  const landmarkStroke = Math.max(3, minSide / 160);
  const badgeR = Math.max(9, minSide / 70);

  for (let index = 0; index < results.length; index += 1) {
    const corners = toCornerPoints(results[index]!).map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
    }));
    if (corners.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < corners.length; i += 1) {
      ctx.lineTo(corners[i]!.x, corners[i]!.y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.stroke();

    if (showLandmarks && corners.length >= 4) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = landmarkStroke;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < corners.length; i += 1) {
        const corner = corners[i]!;
        const prev = corners[(i + corners.length - 1) % corners.length]!;
        const next = corners[(i + 1) % corners.length]!;
        const toPrev = unitToward(corner, prev);
        const toNext = unitToward(corner, next);
        ctx.beginPath();
        ctx.moveTo(
          corner.x + toPrev.x * landmarkLen,
          corner.y + toPrev.y * landmarkLen,
        );
        ctx.lineTo(corner.x, corner.y);
        ctx.lineTo(
          corner.x + toNext.x * landmarkLen,
          corner.y + toNext.y * landmarkLen,
        );
        ctx.stroke();
      }
    }

    if (showIndices) {
      const badge = corners[0]!;
      ctx.beginPath();
      ctx.arc(badge.x, badge.y, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${Math.round(badgeR * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), badge.x, badge.y);
    }
  }

  try {
    return canvas.toDataURL(
      options.mimeType ?? "image/jpeg",
      options.quality ?? 0.92,
    );
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
