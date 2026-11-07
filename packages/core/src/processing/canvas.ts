import { BarcodeError } from "../errors/BarcodeError.js";

export interface SizedCanvas {
  canvas: HTMLCanvasElement;
  sourceWidth: number;
  sourceHeight: number;
  cleanup: () => void;
}

function getDocument(): Document {
  if (typeof document === "undefined") {
    throw new BarcodeError(
      "UNSUPPORTED_BROWSER",
      "DOM APIs are required for image/frame processing.",
    );
  }
  return document;
}

export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx =
    canvas.getContext("2d", { willReadFrequently: true }) ?? canvas.getContext("2d");
  if (!ctx) {
    throw new BarcodeError("SCAN_FAILED", "Unable to create 2D canvas context.");
  }
  return ctx;
}

export function needsDownscale(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
): boolean {
  if (!maxWidth && !maxHeight) return false;
  return (
    (maxWidth !== undefined && width > maxWidth) ||
    (maxHeight !== undefined && height > maxHeight)
  );
}

export function createProcessingCanvas(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth?: number,
  maxHeight?: number,
): HTMLCanvasElement {
  const doc = getDocument();
  const canvas = doc.createElement("canvas");

  let width = sourceWidth;
  let height = sourceHeight;
  const maxW = maxWidth ?? sourceWidth;
  const maxH = maxHeight ?? sourceHeight;

  if (width > maxW || height > maxH) {
    const scale = Math.min(maxW / width, maxH / height);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }

  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function drawVideoFrame(
  video: HTMLVideoElement,
  maxWidth?: number,
  maxHeight?: number,
): SizedCanvas {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new BarcodeError("SCAN_FAILED", "Video frame has no dimensions yet.");
  }

  const canvas = createProcessingCanvas(sourceWidth, sourceHeight, maxWidth, maxHeight);
  const ctx = get2dContext(canvas);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return {
    canvas,
    sourceWidth,
    sourceHeight,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

export function drawCanvasElement(
  source: HTMLCanvasElement,
  maxWidth?: number,
  maxHeight?: number,
): SizedCanvas {
  if (!needsDownscale(source.width, source.height, maxWidth, maxHeight)) {
    return {
      canvas: source,
      sourceWidth: source.width,
      sourceHeight: source.height,
      cleanup: () => undefined,
    };
  }

  const canvas = createProcessingCanvas(source.width, source.height, maxWidth, maxHeight);
  const ctx = get2dContext(canvas);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return {
    canvas,
    sourceWidth: source.width,
    sourceHeight: source.height,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

export async function drawImageElement(
  image: HTMLImageElement,
  maxWidth?: number,
  maxHeight?: number,
): Promise<SizedCanvas> {
  if (!image.complete || image.naturalWidth === 0) {
    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new BarcodeError("IMAGE_LOAD_FAILED", "Failed to load image element."));
      };
      const cleanup = () => {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
      };
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
    });
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new BarcodeError("IMAGE_LOAD_FAILED", "Image has no dimensions.");
  }

  const canvas = createProcessingCanvas(sourceWidth, sourceHeight, maxWidth, maxHeight);
  const ctx = get2dContext(canvas);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    canvas,
    sourceWidth,
    sourceHeight,
    cleanup: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

export async function drawBlob(
  blob: Blob,
  maxWidth?: number,
  maxHeight?: number,
): Promise<SizedCanvas> {
  if (typeof URL === "undefined" || typeof Image === "undefined") {
    throw new BarcodeError(
      "UNSUPPORTED_BROWSER",
      "Blob image scanning requires URL and Image APIs.",
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new BarcodeError("IMAGE_LOAD_FAILED", "Failed to load image from Blob."));
      image.src = objectUrl;
    });
    return await drawImageElement(image, maxWidth, maxHeight);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
