import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import { get2dContext } from "./canvas.js";
import { enhanceCropPixels } from "./cropBarcode.js";

/** Default multi-scale ladder — original first, then modest upscales. */
export const DEFAULT_DECODE_SCALES = [1, 1.5, 2] as const;

/** Alternate orientations for still-image rotation retry. */
export const DEFAULT_DECODE_ROTATIONS = [0, 90, 180, 270] as const;

export type DecodeRotationDegrees = 0 | 90 | 180 | 270;

export interface DecodePipelineOptions {
  /** Run initial direct decode before fallbacks. Default true. */
  tryDirect?: boolean;
  /** Multi-scale ladder. Default true. */
  multiScale?: boolean;
  scales?: readonly number[];
  /** Contrast/grayscale (+ mild sharpen) pass. Default true. */
  imageEnhancement?: boolean;
  /** Rotation retries. Default true. */
  rotationRetry?: boolean;
  rotations?: readonly DecodeRotationDegrees[];
  /**
   * Force ZXing TRY_HARDER for fallback passes (restore afterward).
   * Default true.
   */
  forceTryHarderOnFallback?: boolean;
  /** Value restored after forced TRY_HARDER fallbacks. Default false. */
  restoreTryHarder?: boolean;
  /**
   * When true, only run enhancement (no multi-scale / rotation). Used for the
   * live zoom canvas pass.
   */
  enhancementOnly?: boolean;
}

export interface OwnedCanvas {
  canvas: HTMLCanvasElement;
  cleanup: () => void;
}

/** Aspect-preserving canvas resize. Caller must cleanup(). */
export function resizeCanvas(
  source: HTMLCanvasElement,
  scale: number,
): OwnedCanvas {
  const factor = Math.max(0.01, scale);
  const width = Math.max(1, Math.round(source.width * factor));
  const height = Math.max(1, Math.round(source.height * factor));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = factor > 1 ? false : true;
  ctx.drawImage(source, 0, 0, width, height);
  return {
    canvas,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Rotate canvas clockwise by 0/90/180/270. Caller must cleanup(). */
export function rotateCanvas(
  source: HTMLCanvasElement,
  degrees: DecodeRotationDegrees,
): OwnedCanvas {
  if (degrees === 0) {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    get2dContext(canvas).drawImage(source, 0, 0);
    return {
      canvas,
      cleanup: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  }

  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? source.height : source.width;
  canvas.height = swap ? source.width : source.height;
  const ctx = get2dContext(canvas);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return {
    canvas,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/**
 * Grayscale + contrast boost and optional 3×3 sharpen for decode fallback.
 * Mutates a copy — leaves the source canvas unchanged.
 */
export function enhanceForDecode(
  source: HTMLCanvasElement,
  options: { contrast?: number; sharpen?: boolean } = {},
): OwnedCanvas {
  const contrast = options.contrast ?? 1.5;
  const sharpen = options.sharpen ?? true;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = get2dContext(canvas);
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  enhanceCropPixels(imageData.data, { grayscale: true, contrast });
  if (sharpen) {
    sharpenPixels(imageData.data, canvas.width, canvas.height);
  }
  ctx.putImageData(imageData, 0, 0);
  return {
    canvas,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Map decode geometry from a uniformly scaled canvas back to source space. */
export function mapResultFromScale(
  result: BarcodeResult,
  scale: number,
): BarcodeResult {
  if (scale === 1) return result;
  const mapPoint = (point: { x: number; y: number }) => ({
    x: point.x / scale,
    y: point.y / scale,
  });
  return {
    ...result,
    points: result.points?.map(mapPoint),
    boundingBox: result.boundingBox
      ? {
          x: result.boundingBox.x / scale,
          y: result.boundingBox.y / scale,
          width: result.boundingBox.width / scale,
          height: result.boundingBox.height / scale,
        }
      : undefined,
  };
}

/**
 * Map a point from a clockwise-rotated canvas back into the pre-rotation
 * source coordinate system.
 */
export function unrotatePoint(
  x: number,
  y: number,
  degrees: DecodeRotationDegrees,
  sourceWidth: number,
  sourceHeight: number,
): { x: number; y: number } {
  switch (degrees) {
    case 0:
      return { x, y };
    case 90:
      // Rotated canvas is (sourceHeight × sourceWidth); (x,y) → (y, H-1-x)
      return { x: y, y: sourceHeight - 1 - x };
    case 180:
      return { x: sourceWidth - 1 - x, y: sourceHeight - 1 - y };
    case 270:
      // Rotated canvas is (sourceHeight × sourceWidth); (x,y) → (W-1-y, x)
      return { x: sourceWidth - 1 - y, y: x };
  }
}

/** Map decode geometry from a rotated canvas back to the original source. */
export function mapResultFromRotation(
  result: BarcodeResult,
  degrees: DecodeRotationDegrees,
  sourceWidth: number,
  sourceHeight: number,
): BarcodeResult {
  if (degrees === 0) return result;

  const mapPoint = (point: { x: number; y: number }) =>
    unrotatePoint(point.x, point.y, degrees, sourceWidth, sourceHeight);

  const points = result.points?.map(mapPoint);
  let boundingBox = result.boundingBox;
  if (boundingBox) {
    const corners = [
      mapPoint({ x: boundingBox.x, y: boundingBox.y }),
      mapPoint({ x: boundingBox.x + boundingBox.width, y: boundingBox.y }),
      mapPoint({
        x: boundingBox.x + boundingBox.width,
        y: boundingBox.y + boundingBox.height,
      }),
      mapPoint({ x: boundingBox.x, y: boundingBox.y + boundingBox.height }),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  return {
    ...result,
    points,
    boundingBox,
  };
}

/**
 * Staged decode fallbacks: direct → multi-scale → enhance → rotation.
 * Reuses the caller's decoder instance.
 */
export async function decodeWithFallbacks(
  decoder: DecoderAdapter,
  canvas: HTMLCanvasElement,
  options: DecodePipelineOptions = {},
): Promise<BarcodeResult | null> {
  const tryDirect = options.tryDirect ?? true;
  const multiScale = options.multiScale ?? true;
  const imageEnhancement = options.imageEnhancement ?? true;
  const rotationRetry = options.rotationRetry ?? true;
  const forceTryHarder = options.forceTryHarderOnFallback ?? true;
  const restoreTryHarder = options.restoreTryHarder ?? false;
  const enhancementOnly = options.enhancementOnly ?? false;
  const scales = options.scales ?? DEFAULT_DECODE_SCALES;
  const rotations = options.rotations ?? DEFAULT_DECODE_ROTATIONS;

  if (tryDirect) {
    const direct = await decoder.decode({ canvas });
    if (direct) return direct;
  }

  if (enhancementOnly) {
    if (!imageEnhancement) return null;
    return withForcedTryHarder(decoder, forceTryHarder, restoreTryHarder, async () => {
      const enhanced = enhanceForDecode(canvas);
      try {
        return await decoder.decode({ canvas: enhanced.canvas });
      } finally {
        enhanced.cleanup();
      }
    });
  }

  return withForcedTryHarder(decoder, forceTryHarder, restoreTryHarder, async () => {
    if (multiScale) {
      for (const scale of scales) {
        if (scale === 1) continue; // already tried as direct
        const scaled = resizeCanvas(canvas, scale);
        try {
          const decoded = await decoder.decode({ canvas: scaled.canvas });
          if (decoded) return mapResultFromScale(decoded, scale);
        } finally {
          scaled.cleanup();
        }
      }
    }

    let enhanceBase: OwnedCanvas | null = null;
    try {
      if (imageEnhancement) {
        enhanceBase = enhanceForDecode(canvas);
        const enhancedHit = await decoder.decode({ canvas: enhanceBase.canvas });
        if (enhancedHit) return enhancedHit;

        if (multiScale) {
          for (const scale of scales) {
            if (scale === 1) continue;
            const scaled = resizeCanvas(enhanceBase.canvas, scale);
            try {
              const decoded = await decoder.decode({ canvas: scaled.canvas });
              if (decoded) return mapResultFromScale(decoded, scale);
            } finally {
              scaled.cleanup();
            }
          }
        }
      }

      if (rotationRetry) {
        const rotationSource = enhanceBase?.canvas ?? canvas;
        for (const degrees of rotations) {
          if (degrees === 0) continue; // already tried
          const rotated = rotateCanvas(rotationSource, degrees);
          try {
            const decoded = await decoder.decode({ canvas: rotated.canvas });
            if (decoded) {
              return mapResultFromRotation(
                decoded,
                degrees,
                canvas.width,
                canvas.height,
              );
            }
          } finally {
            rotated.cleanup();
          }
        }
      }
    } finally {
      enhanceBase?.cleanup();
    }

    return null;
  });
}

async function withForcedTryHarder<T>(
  decoder: DecoderAdapter,
  force: boolean,
  restore: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  if (!force || !decoder.setTryHarder) {
    return fn();
  }
  decoder.setTryHarder(true);
  try {
    return await fn();
  } finally {
    decoder.setTryHarder(restore);
  }
}

/** Mild unsharp-style 3×3 kernel (in place, luma channels only). */
function sharpenPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  if (width < 3 || height < 3) return;
  const copy = new Uint8ClampedArray(data);
  const idx = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = copy[idx(x, y)]!;
      const sum =
        -copy[idx(x - 1, y)]! -
        copy[idx(x + 1, y)]! -
        copy[idx(x, y - 1)]! -
        copy[idx(x, y + 1)]! +
        center * 5;
      const v = Math.min(255, Math.max(0, sum | 0));
      const i = idx(x, y);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }
}
