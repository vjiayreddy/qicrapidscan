import type { OpenCvRuntime } from "./opencvReady.js";

export type CvMat = {
  cols: number;
  rows: number;
  data: Uint8Array;
  type?: () => number;
  copyTo?: (dst: unknown) => void;
  delete: () => void;
};

type CvBottle = OpenCvRuntime & {
  Point: new (x: number, y: number) => unknown;
  rectangle: (...args: unknown[]) => void;
  morphologyEx: (...args: unknown[]) => void;
  getStructuringElement: (shape: number, ksize: unknown) => CvMat;
  normalize: (...args: unknown[]) => void;
  bitwise_not: (...args: unknown[]) => void;
  MORPH_RECT?: number;
  MORPH_BLACKHAT?: number;
  NORM_MINMAX?: number;
  CV_8UC1?: number;
};

export function safeDelete(mat: { delete: () => void } | null | undefined): void {
  if (!mat) return;
  try {
    mat.delete();
  } catch {
    // already freed
  }
}

/**
 * Whiten a thin outer rim so label text / bottle edges don't touch the
 * DataMatrix before we add a synthetic quiet zone.
 *
 * Keep this tiny — a large wipe eats the L-finder when YOLO crops are tight.
 */
export function cleanBorderNoise(cvRuntime: OpenCvRuntime, grayMat: CvMat): void {
  const cv = cvRuntime as CvBottle;
  if (typeof cv.rectangle !== "function" || typeof cv.Point !== "function") {
    return;
  }
  const w = grayMat.cols;
  const h = grayMat.rows;
  // ~1.5% / max 6px — only clears packaging that survived ROI padding.
  const marginX = Math.min(6, Math.max(2, Math.round(w * 0.015)));
  const marginY = Math.min(6, Math.max(2, Math.round(h * 0.015)));
  const white = new cv.Scalar(255);
  cv.rectangle(grayMat, new cv.Point(0, 0), new cv.Point(w, marginY), white, -1);
  cv.rectangle(
    grayMat,
    new cv.Point(0, h - marginY),
    new cv.Point(w, h),
    white,
    -1,
  );
  cv.rectangle(grayMat, new cv.Point(0, 0), new cv.Point(marginX, h), white, -1);
  cv.rectangle(
    grayMat,
    new cv.Point(w - marginX, 0),
    new cv.Point(w, h),
    white,
    -1,
  );
}

/**
 * Non-linear cylindrical unwarp: stretch compressed outer edges of a bottle face.
 * @param maxAngle Strength of unroll (≈0.4 mild … 0.9 strong). Default 0.65.
 */
export function dewarpCylinder(
  cvRuntime: OpenCvRuntime,
  srcMat: CvMat,
  direction: "horizontal" | "vertical" = "horizontal",
  maxAngle = 0.65,
): CvMat {
  const cv = cvRuntime as CvBottle;
  const rows = srcMat.rows;
  const cols = srcMat.cols;
  const type = srcMat.type?.() ?? cv.CV_8U;
  const dst = new cv.Mat(rows, cols, type, new cv.Scalar(255)) as CvMat;

  const srcData = srcMat.data;
  const dstData = dst.data;
  const cx = cols / 2;
  const cy = rows / 2;
  const angle = Math.max(0.15, Math.min(1.1, maxAngle));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let sx = x;
      let sy = y;
      if (direction === "horizontal") {
        const normX = cx > 0 ? (x - cx) / cx : 0;
        const theta = normX * angle;
        const denom = Math.sin(angle) || 1;
        const mappedNormX = Math.sin(theta) / denom;
        sx = Math.round(cx + mappedNormX * cx);
      } else {
        const normY = cy > 0 ? (y - cy) / cy : 0;
        const theta = normY * angle;
        const denom = Math.sin(angle) || 1;
        const mappedNormY = Math.sin(theta) / denom;
        sy = Math.round(cy + mappedNormY * cy);
      }
      if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
        dstData[y * cols + x] = srcData[sy * cols + sx]!;
      }
    }
  }
  return dst;
}

/**
 * Morphological black-hat → invert → Otsu: isolate dark modules under curved shading.
 */
export function blackHatBinary(
  cvRuntime: OpenCvRuntime,
  grayMat: CvMat,
): CvMat | null {
  const cv = cvRuntime as CvBottle;
  if (
    typeof cv.morphologyEx !== "function" ||
    typeof cv.getStructuringElement !== "function"
  ) {
    return null;
  }

  const kernelSize = Math.max(
    15,
    Math.round(Math.min(grayMat.cols, grayMat.rows) / 6) | 1,
  );
  const se = cv.getStructuringElement(
    cv.MORPH_RECT ?? 0,
    new cv.Size(kernelSize, kernelSize),
  );
  const blackhat = new cv.Mat() as CvMat;
  const shadowFree = new cv.Mat() as CvMat;
  const shadowFreeBin = new cv.Mat() as CvMat;

  try {
    cv.morphologyEx(
      grayMat as never,
      blackhat as never,
      cv.MORPH_BLACKHAT ?? 6,
      se as never,
    );
    safeDelete(se);
    cv.normalize(
      blackhat as never,
      blackhat as never,
      0,
      255,
      cv.NORM_MINMAX ?? 32,
    );
    cv.bitwise_not(blackhat as never, shadowFree as never);
    cv.threshold(
      shadowFree as never,
      shadowFreeBin as never,
      0,
      255,
      cv.THRESH_BINARY | cv.THRESH_OTSU,
    );
    return shadowFreeBin;
  } catch {
    safeDelete(se);
    safeDelete(shadowFreeBin);
    return null;
  } finally {
    safeDelete(blackhat);
    safeDelete(shadowFree);
  }
}
