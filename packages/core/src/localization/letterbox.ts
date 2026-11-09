export interface LetterboxMeta {
  /** Scale applied to source → letterbox canvas. */
  scale: number;
  /** Left pad in letterbox pixels. */
  padX: number;
  /** Top pad in letterbox pixels. */
  padY: number;
  sourceWidth: number;
  sourceHeight: number;
  inputSize: number;
}

export interface LetterboxResult {
  /** NCHW float32 RGB in [0, 1], length 3 * inputSize * inputSize. */
  tensor: Float32Array;
  meta: LetterboxMeta;
}

/**
 * Letterbox an ImageData into a square NCHW float tensor (Ultralytics-style).
 * Gray pad (114/255) matches common YOLO exports.
 */
export function letterboxImageData(
  imageData: ImageData,
  inputSize: number,
): LetterboxResult {
  const sourceWidth = imageData.width;
  const sourceHeight = imageData.height;
  const scale = Math.min(inputSize / sourceWidth, inputSize / sourceHeight);
  const newW = Math.round(sourceWidth * scale);
  const newH = Math.round(sourceHeight * scale);
  const padX = Math.floor((inputSize - newW) / 2);
  const padY = Math.floor((inputSize - newH) / 2);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(inputSize, inputSize)
      : (() => {
          const c = document.createElement("canvas");
          c.width = inputSize;
          c.height = inputSize;
          return c;
        })();

  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) {
    throw new Error("2D canvas context unavailable for letterbox.");
  }

  ctx.fillStyle = "rgb(114, 114, 114)";
  ctx.fillRect(0, 0, inputSize, inputSize);

  // Draw source pixels via a temporary canvas so we can use drawImage.
  const srcCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(sourceWidth, sourceHeight)
      : (() => {
          const c = document.createElement("canvas");
          c.width = sourceWidth;
          c.height = sourceHeight;
          return c;
        })();
  const srcCtx = srcCanvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!srcCtx) {
    throw new Error("2D canvas context unavailable for source blit.");
  }
  srcCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(srcCanvas as CanvasImageSource, padX, padY, newW, newH);

  const packed = ctx.getImageData(0, 0, inputSize, inputSize);
  const { data } = packed;
  const plane = inputSize * inputSize;
  const tensor = new Float32Array(3 * plane);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    tensor[p] = data[i]! / 255;
    tensor[p + plane] = data[i + 1]! / 255;
    tensor[p + plane * 2] = data[i + 2]! / 255;
  }

  return {
    tensor,
    meta: {
      scale,
      padX,
      padY,
      sourceWidth,
      sourceHeight,
      inputSize,
    },
  };
}

/** Map a box from letterbox pixel space back to source image pixels. */
export function mapBoxToSource(
  box: { x1: number; y1: number; x2: number; y2: number },
  meta: LetterboxMeta,
): { x: number; y: number; width: number; height: number } {
  const x1 = (box.x1 - meta.padX) / meta.scale;
  const y1 = (box.y1 - meta.padY) / meta.scale;
  const x2 = (box.x2 - meta.padX) / meta.scale;
  const y2 = (box.y2 - meta.padY) / meta.scale;

  const left = Math.max(0, Math.min(meta.sourceWidth, Math.min(x1, x2)));
  const top = Math.max(0, Math.min(meta.sourceHeight, Math.min(y1, y2)));
  const right = Math.max(0, Math.min(meta.sourceWidth, Math.max(x1, x2)));
  const bottom = Math.max(0, Math.min(meta.sourceHeight, Math.max(y1, y2)));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}
