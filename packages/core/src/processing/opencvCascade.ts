import {
  readBarcodesFromImageData,
  type ReaderOptions,
  type ReadResult,
} from "zxing-wasm/reader";
import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import {
  blackHatBinary,
  cleanBorderNoise,
  dewarpCylinder,
  safeDelete,
  type CvMat,
} from "./opencvBottleOps.js";
import { ensureOpenCv, type OpenCvRuntime } from "./opencvReady.js";
import {
  rectifyDataMatrixSymbol,
  straightenBarcodeGray,
} from "./opencvStraighten.js";
import {
  cascadeZxingFormats,
  computeCascadeScaleFactor,
  mapZxingReadResult,
} from "./zxingFormats.js";

export interface CascadeDecodeOptions {
  /** SDK formats; DataMatrix is preferred when enabled. */
  formats?: readonly BarcodeFormat[];
  /** Synthetic quiet-zone border in pixels. Default 28. */
  quietZonePx?: number;
  /** Minimum crop edge after cubic upscale. Default 280 (~2×–4× on bottle ROIs). */
  minTargetSize?: number;
  /** Staged opencv.js URL (preferred in Next.js / playground). */
  openCvScriptUrl?: string;
  /**
   * Optional decode injector for tests. Receives RGBA ImageData + options.
   * Return the first ZXing-like hit or null.
   */
  tryDecode?: (
    imageData: ImageData,
    options: ReaderOptions,
  ) => Promise<ReadResult | null>;
}

export interface CascadeDecodeMeta {
  stage: number;
  stageName: string;
}

export interface CascadeDecodeHit {
  result: BarcodeResult;
  meta: CascadeDecodeMeta;
  /**
   * JPEG of the OpenCV enhancement variant that ZXing actually decoded
   * (quiet-zone bordered). Prefer this for UI thumbs over the raw YOLO crop.
   */
  enhancedDataUrl?: string;
}

/**
 * Cascade outcome — always includes a diagnostic preview when OpenCV ran,
 * even if ZXing never hit (so failed ROI thumbs are not misleading raw crops).
 */
export interface CascadeDecodeOutcome {
  hit: CascadeDecodeHit | null;
  /** High-contrast OpenCV preview of the best geometry tried. */
  previewDataUrl?: string;
}

type CvLike = OpenCvRuntime;

function baseZxingConfig(
  formats: ReturnType<typeof cascadeZxingFormats>,
): ReaderOptions {
  return {
    formats,
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: false,
    tryDenoise: true,
    maxNumberOfSymbols: 1,
  };
}

/**
 * Adds a solid pure-white (255) quiet-zone border around a 1-channel Mat.
 */
export function addWhiteQuietZone(
  cv: CvLike,
  grayMat: CvMat,
  borderPx = 28,
): CvMat {
  const padded = new cv.Mat() as CvMat;
  const white = new cv.Scalar(255, 255, 255, 255);
  cv.copyMakeBorder(
    grayMat as never,
    padded as never,
    borderPx,
    borderPx,
    borderPx,
    borderPx,
    cv.BORDER_CONSTANT,
    white,
  );
  return padded;
}

/**
 * Encode a 1-channel gray Mat as a JPEG data URL for UI / debug thumbs.
 * Downscales to `maxEdge` so playground lists stay light.
 */
export function grayMatToJpegDataUrl(
  cv: CvLike,
  grayMat: CvMat,
  options: { maxEdge?: number; quality?: number } = {},
): string | null {
  if (typeof document === "undefined") return null;
  const cols = grayMat.cols;
  const rows = grayMat.rows;
  if (cols < 1 || rows < 1) return null;

  const maxEdge = options.maxEdge ?? 192;
  const scale = Math.min(1, maxEdge / Math.max(cols, rows));
  const outW = Math.max(1, Math.round(cols * scale));
  const outH = Math.max(1, Math.round(rows * scale));

  let display: CvMat = grayMat;
  let resized: CvMat | null = null;
  if (outW !== cols || outH !== rows) {
    resized = new cv.Mat() as CvMat;
    cv.resize(
      grayMat as never,
      resized as never,
      new cv.Size(outW, outH),
      0,
      0,
      cv.INTER_CUBIC,
    );
    display = resized;
  }

  const rgba = new cv.Mat() as CvMat;
  try {
    cv.cvtColor(display as never, rgba as never, cv.COLOR_GRAY2RGBA, 0);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = new ImageData(
      new Uint8ClampedArray(rgba.data),
      outW,
      outH,
    );
    ctx.putImageData(imageData, 0, 0);
    try {
      return canvas.toDataURL("image/jpeg", options.quality ?? 0.88);
    } catch {
      return null;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    safeDelete(rgba);
    safeDelete(resized);
  }
}

async function defaultTryDecode(
  imageData: ImageData,
  options: ReaderOptions,
): Promise<ReadResult | null> {
  try {
    const barcodes = await readBarcodesFromImageData(imageData, options);
    const hit = barcodes.find((item) => item.isValid && item.text);
    return hit ?? null;
  } catch {
    return null;
  }
}

export interface CascadeGeometry {
  /** Horizontal scale from original tile → cascade image (before quiet zone). */
  scaleX: number;
  /** Vertical scale from original tile → cascade image (before quiet zone). */
  scaleY: number;
  /** Synthetic white border added on each side (cascade pixels). */
  quietZonePx: number;
}

/**
 * Map ZXing corners from cascade space back to the original YOLO tile canvas.
 */
export function mapCascadeGeometryToTile(
  result: BarcodeResult,
  geometry: CascadeGeometry,
): BarcodeResult {
  const { scaleX, scaleY, quietZonePx } = geometry;
  const invX = scaleX > 0 ? 1 / scaleX : 1;
  const invY = scaleY > 0 ? 1 / scaleY : 1;
  const mapPoint = (point: { x: number; y: number }) => ({
    x: (point.x - quietZonePx) * invX,
    y: (point.y - quietZonePx) * invY,
  });

  const points = result.points?.map(mapPoint);
  let boundingBox = result.boundingBox;
  if (boundingBox) {
    const topLeft = mapPoint({ x: boundingBox.x, y: boundingBox.y });
    boundingBox = {
      x: topLeft.x,
      y: topLeft.y,
      width: boundingBox.width * invX,
      height: boundingBox.height * invY,
    };
  } else if (points && points.length > 0) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    boundingBox = {
      x: minX,
      y: minY,
      width: Math.max(1, Math.max(...xs) - minX),
      height: Math.max(1, Math.max(...ys) - minY),
    };
  }

  return {
    ...result,
    points,
    boundingBox,
  };
}

/** @deprecated Prefer CascadeGeometry with scaleX/scaleY. */
export function mapCascadeGeometryToTileUniform(
  result: BarcodeResult,
  geometry: { scaleFactor: number; quietZonePx: number },
): BarcodeResult {
  return mapCascadeGeometryToTile(result, {
    scaleX: geometry.scaleFactor,
    scaleY: geometry.scaleFactor,
    quietZonePx: geometry.quietZonePx,
  });
}

/**
 * Convert a 1-channel grayscale Mat to ImageData and run ZXing-WASM.
 */
export async function tryZXingDecode(
  cv: CvLike,
  grayMat: CvMat,
  zxingConfig: ReaderOptions,
  tryDecode: CascadeDecodeOptions["tryDecode"] = defaultTryDecode,
  geometry?: CascadeGeometry,
): Promise<BarcodeResult | null> {
  const rgbaMat = new cv.Mat() as CvMat;
  try {
    cv.cvtColor(grayMat as never, rgbaMat as never, cv.COLOR_GRAY2RGBA, 0);
    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaMat.data),
      rgbaMat.cols,
      rgbaMat.rows,
    );
    const hit = await tryDecode(imgData, zxingConfig);
    if (!hit) return null;
    const mapped = mapZxingReadResult(hit);
    if (!mapped) return null;
    return geometry ? mapCascadeGeometryToTile(mapped, geometry) : mapped;
  } finally {
    safeDelete(rgbaMat);
  }
}

type EnhancementCandidate = {
  name: string;
  mat: CvMat;
  fixedThreshold?: boolean;
};

function applyClahe(cv: CvLike, grayMat: CvMat, clipLimit = 3.5): CvMat {
  const out = new cv.Mat() as CvMat;
  const clahe = new cv.CLAHE(clipLimit, new cv.Size(8, 8));
  try {
    clahe.apply(grayMat as never, out as never);
  } finally {
    safeDelete(clahe);
  }
  return out;
}

function applyMedianDenoise(cv: CvLike, grayMat: CvMat, ksize = 3): CvMat {
  const out = new cv.Mat() as CvMat;
  cv.medianBlur(grayMat as never, out as never, ksize);
  return out;
}

/** Mild unsharp mask — recovers soft DataMatrix module edges. */
function applyUnsharp(
  cv: CvLike,
  grayMat: CvMat,
  amount = 1.8,
  sigma = 1.2,
): CvMat {
  const blurred = new cv.Mat() as CvMat;
  const out = new cv.Mat() as CvMat;
  try {
    cv.GaussianBlur(
      grayMat as never,
      blurred as never,
      new cv.Size(0, 0),
      sigma,
    );
    cv.addWeighted(
      grayMat as never,
      amount,
      blurred as never,
      1 - amount,
      0,
      out as never,
    );
    return out;
  } finally {
    safeDelete(blurred);
  }
}

function applyOtsu(cv: CvLike, grayMat: CvMat): CvMat {
  const out = new cv.Mat() as CvMat;
  cv.threshold(
    grayMat as never,
    out as never,
    0,
    255,
    (cv.THRESH_BINARY ?? 0) | (cv.THRESH_OTSU ?? 8),
  );
  return out;
}

function applyAdaptive(
  cv: CvLike,
  grayMat: CvMat,
  blockSize: number,
  C = 5,
): CvMat {
  const out = new cv.Mat() as CvMat;
  cv.adaptiveThreshold(
    grayMat as never,
    out as never,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    blockSize,
    C,
  );
  return out;
}

/**
 * Branching enhancement ladder — each step is a separate ZXing candidate.
 * Do not stack every filter onto one image; generate variants and decode each.
 *
 * Order: raw → CLAHE → denoise → sharpen → black-hat / Otsu / adaptive thresholds.
 */
async function runImageFiltersOnCandidate(
  cv: CvLike,
  grayMat: CvMat,
  zxingConfig: ReaderOptions,
  tryDecode: CascadeDecodeOptions["tryDecode"],
  quietZonePx: number,
  geometry: CascadeGeometry,
): Promise<CascadeDecodeHit | null> {
  const owned: CvMat[] = [];
  const keep = (mat: CvMat): CvMat => {
    owned.push(mat);
    return mat;
  };

  try {
    const clahe = keep(applyClahe(cv, grayMat, 3.5));
    const denoised = keep(applyMedianDenoise(cv, clahe, 3));
    const sharpened = keep(applyUnsharp(cv, denoised, 1.85, 1.15));
    const claheSharp = keep(applyUnsharp(cv, clahe, 1.7, 1.0));

    const candidates: EnhancementCandidate[] = [
      { name: "raw_quiet", mat: grayMat },
      { name: "clahe", mat: clahe },
      { name: "clahe_denoise", mat: denoised },
      { name: "clahe_denoise_sharp", mat: sharpened },
      { name: "clahe_sharp", mat: claheSharp },
    ];

    const blackHat = blackHatBinary(cv, grayMat);
    if (blackHat) {
      candidates.push({
        name: "blackhat",
        mat: keep(blackHat),
        fixedThreshold: true,
      });
    }

    candidates.push({
      name: "otsu_sharp",
      mat: keep(applyOtsu(cv, sharpened)),
      fixedThreshold: true,
    });
    candidates.push({
      name: "otsu_clahe",
      mat: keep(applyOtsu(cv, clahe)),
      fixedThreshold: true,
    });

    for (const block of [21, 31, 41] as const) {
      candidates.push({
        name: `adaptive_sharp_${block}`,
        mat: keep(applyAdaptive(cv, sharpened, block, 5)),
        fixedThreshold: true,
      });
      candidates.push({
        name: `adaptive_clahe_${block}`,
        mat: keep(applyAdaptive(cv, clahe, block, 7)),
        fixedThreshold: true,
      });
    }

    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i]!;
      const bordered = addWhiteQuietZone(cv, candidate.mat, quietZonePx);
      try {
        const config = candidate.fixedThreshold
          ? { ...zxingConfig, binarizer: "FixedThreshold" as const }
          : zxingConfig;
        const result = await tryZXingDecode(
          cv,
          bordered,
          config,
          tryDecode,
          geometry,
        );
        if (result) {
          const enhancedDataUrl =
            grayMatToJpegDataUrl(cv, bordered, { maxEdge: 192 }) ?? undefined;
          return {
            result,
            meta: { stage: i + 1, stageName: candidate.name },
            enhancedDataUrl,
          };
        }
      } finally {
        safeDelete(bordered);
      }
    }

    return null;
  } finally {
    for (const mat of owned) safeDelete(mat);
  }
}

/**
 * Stretch to full 0–255, then lift midtones so label gray becomes near-white
 * and modules read darker — fixes muddy failed-ROI thumbs.
 */
function liftPreviewTone(cv: CvLike, grayMat: CvMat): CvMat {
  const stretched = new cv.Mat() as CvMat;
  const cvAny = cv as CvLike & {
    normalize?: (...args: unknown[]) => void;
    NORM_MINMAX?: number;
  };
  if (typeof cvAny.normalize === "function") {
    cvAny.normalize(
      grayMat as never,
      stretched as never,
      0,
      255,
      cvAny.NORM_MINMAX ?? 32,
    );
  } else if (typeof grayMat.copyTo === "function") {
    grayMat.copyTo(stretched);
  } else {
    cv.resize(
      grayMat as never,
      stretched as never,
      new cv.Size(grayMat.cols, grayMat.rows),
      0,
      0,
      cv.INTER_CUBIC,
    );
  }

  // contrast * pixel + brightness → brighter paper, punchier modules
  const lifted = new cv.Mat() as CvMat;
  cv.addWeighted(
    stretched as never,
    1.4,
    stretched as never,
    0,
    32,
    lifted as never,
  );
  safeDelete(stretched);
  return lifted;
}

/**
 * Readable diagnostic thumb for failed ROIs:
 * CLAHE → denoise → tone lift (brighter) → sharpen — not hard binary.
 */
function buildCascadePreviewDataUrl(
  cv: CvLike,
  grayMat: CvMat,
  quietZonePx: number,
): string | undefined {
  const clahe = applyClahe(cv, grayMat, 5.0);
  const denoised = applyMedianDenoise(cv, clahe, 3);
  const lifted = liftPreviewTone(cv, denoised);
  const sharp = applyUnsharp(cv, lifted, 1.9, 1.05);
  const bordered = addWhiteQuietZone(cv, sharp, quietZonePx);
  try {
    return (
      grayMatToJpegDataUrl(cv, bordered, { maxEdge: 192, quality: 0.92 }) ??
      undefined
    );
  } finally {
    safeDelete(bordered);
    safeDelete(sharp);
    safeDelete(lifted);
    safeDelete(denoised);
    safeDelete(clahe);
  }
}

/**
 * Bottle-optimized OpenCV recovery cascade for localized DataMatrix crops.
 *
 * Pipeline: pad crop → grayscale → upscale (2×–4×) → geometry straighten /
 * stretch / cylinder dewarp → branching enhancement candidates (CLAHE,
 * denoise, sharpen, Otsu, adaptive) → ZXing on each variant.
 *
 * Note: `warpPerspective` (straighten) only fixes planar tilt/skew. Bottle
 * barrel curves need `dewarpCylinder` (pixel remap) — a different transform.
 */
export async function decodeBarcodeWithCascade(
  rawCropCanvas: HTMLCanvasElement,
  options: CascadeDecodeOptions = {},
): Promise<CascadeDecodeOutcome> {
  const cv = await ensureOpenCv(
    options.openCvScriptUrl
      ? { scriptUrl: options.openCvScriptUrl }
      : undefined,
  );
  if (!cv) return { hit: null };

  const quietZonePx = options.quietZonePx ?? 28;
  const minTargetSize = options.minTargetSize ?? 280;
  const tryDecode = options.tryDecode ?? defaultTryDecode;
  const zxingConfig = baseZxingConfig(cascadeZxingFormats(options.formats));

  const src = cv.imread(rawCropCanvas) as CvMat;
  const gray = new cv.Mat() as CvMat;
  const baseGray = new cv.Mat() as CvMat;
  let previewDataUrl: string | undefined;

  try {
    cv.cvtColor(src as never, gray as never, cv.COLOR_RGBA2GRAY, 0);

    const scaleFactor = computeCascadeScaleFactor(
      gray.cols,
      gray.rows,
      minTargetSize,
    );
    cv.resize(
      gray as never,
      baseGray as never,
      new cv.Size(
        Math.round(gray.cols * scaleFactor),
        Math.round(gray.rows * scaleFactor),
      ),
      0,
      0,
      cv.INTER_CUBIC,
    );

    // Erase rim text / bottle edges before quiet zone.
    cleanBorderNoise(cv, baseGray);
    previewDataUrl = buildCascadePreviewDataUrl(cv, baseGray, quietZonePx);

    const tryGeometryCandidate = async (
      mat: CvMat,
      stagePrefix: string,
      quad?: Array<{ x: number; y: number }>,
    ): Promise<CascadeDecodeOutcome | null> => {
      // Decode the rectified symbol, then stronger cylinder unrolls on it.
      const owned: CvMat[] = [];
      try {
        const angles = [0.45, 0.65, 0.85] as const;
        const dirs: Array<"horizontal" | "vertical"> = [
          "horizontal",
          "vertical",
        ];
        const mats: Array<{ mat: CvMat; name: string }> = [
          { mat, name: "flat" },
        ];
        for (const dir of dirs) {
          for (const angle of angles) {
            const d = dewarpCylinder(cv, mat, dir, angle);
            owned.push(d);
            mats.push({ mat: d, name: `dewarp_${dir}_${angle}` });
          }
        }

        for (const candidate of mats) {
          previewDataUrl =
            buildCascadePreviewDataUrl(cv, candidate.mat, quietZonePx) ??
            previewDataUrl;
          const hit = await runImageFiltersOnCandidate(
            cv,
            candidate.mat,
            zxingConfig,
            tryDecode,
            quietZonePx,
            { scaleX: 1, scaleY: 1, quietZonePx },
          );
          if (!hit) continue;

          if (quad && quad.length >= 4) {
            const inv = scaleFactor > 0 ? 1 / scaleFactor : 1;
            const points = quad.map((p) => ({
              x: p.x * inv,
              y: p.y * inv,
            }));
            const xs = points.map((p) => p.x);
            const ys = points.map((p) => p.y);
            return {
              hit: {
                result: {
                  ...hit.result,
                  points,
                  boundingBox: {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
                    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
                  },
                },
                meta: {
                  stage: 0,
                  stageName: `${stagePrefix}_${candidate.name}_${hit.meta.stageName}`,
                },
                enhancedDataUrl: hit.enhancedDataUrl,
              },
              previewDataUrl: hit.enhancedDataUrl ?? previewDataUrl,
            };
          }

          return {
            hit: {
              ...hit,
              meta: {
                stage: hit.meta.stage,
                stageName: `${stagePrefix}_${candidate.name}_${hit.meta.stageName}`,
              },
            },
            previewDataUrl: hit.enhancedDataUrl ?? previewDataUrl,
          };
        }
        return null;
      } finally {
        for (const m of owned) safeDelete(m);
      }
    };

    // 1) Symbol-locked rectify: warp the DataMatrix L-block itself (not outer pad).
    {
      const symbol = rectifyDataMatrixSymbol(
        cv,
        baseGray as Parameters<typeof rectifyDataMatrixSymbol>[1],
        Math.max(minTargetSize, 240),
      );
      if (symbol) {
        try {
          const outcome = await tryGeometryCandidate(
            symbol.warped,
            "symbol",
            symbol.quad,
          );
          if (outcome?.hit) return outcome;
          if (outcome?.previewDataUrl) {
            previewDataUrl = outcome.previewDataUrl;
          }
        } finally {
          safeDelete(symbol.warped);
        }
      }
    }

    // 2) Legacy outer-contour straighten (planar tilt fallback).
    {
      const straightened = straightenBarcodeGray(
        cv,
        baseGray as Parameters<typeof straightenBarcodeGray>[1],
        Math.max(minTargetSize, 240),
      );
      if (straightened) {
        try {
          const outcome = await tryGeometryCandidate(
            straightened.warped,
            "straighten",
            straightened.quad,
          );
          if (outcome?.hit) return outcome;
          if (outcome?.previewDataUrl) {
            previewDataUrl = outcome.previewDataUrl;
          }
        } finally {
          safeDelete(straightened.warped);
        }
      }
    }

    const geometryProfiles: Array<[number, number]> = [
      [1.0, 1.0],
      [1.22, 1.0],
      [1.0, 1.22],
      [1.35, 1.0],
    ];

    for (const [stretchX, stretchY] of geometryProfiles) {
      const geomMat = new cv.Mat() as CvMat;
      const ownedDewarps: CvMat[] = [];
      try {
        if (stretchX === 1 && stretchY === 1) {
          if (typeof baseGray.copyTo === "function") {
            baseGray.copyTo(geomMat);
          } else {
            cv.resize(
              baseGray as never,
              geomMat as never,
              new cv.Size(baseGray.cols, baseGray.rows),
              0,
              0,
              cv.INTER_CUBIC,
            );
          }
        } else {
          cv.resize(
            baseGray as never,
            geomMat as never,
            new cv.Size(
              Math.round(baseGray.cols * stretchX),
              Math.round(baseGray.rows * stretchY),
            ),
            0,
            0,
            cv.INTER_CUBIC,
          );
        }

        const candidates: CvMat[] = [geomMat];
        // Cylinder unwarp at multiple strengths — bottle curves need non-linear remap.
        const primaryDir: "horizontal" | "vertical" =
          stretchY > stretchX ? "vertical" : "horizontal";
        const dewarpAngles =
          stretchX === 1 && stretchY === 1
            ? ([0.45, 0.65, 0.85] as const)
            : ([0.65] as const);
        for (const angle of dewarpAngles) {
          const d = dewarpCylinder(cv, geomMat, primaryDir, angle);
          ownedDewarps.push(d);
          candidates.push(d);
          previewDataUrl =
            buildCascadePreviewDataUrl(cv, d, quietZonePx) ?? previewDataUrl;
        }
        if (stretchX === 1 && stretchY === 1) {
          const altDir =
            primaryDir === "horizontal" ? "vertical" : "horizontal";
          for (const angle of [0.65, 0.85] as const) {
            const d = dewarpCylinder(cv, geomMat, altDir, angle);
            ownedDewarps.push(d);
            candidates.push(d);
          }
        }

        for (const candidate of candidates) {
          const geometry: CascadeGeometry = {
            scaleX: scaleFactor * stretchX,
            scaleY: scaleFactor * stretchY,
            quietZonePx,
          };
          const hit = await runImageFiltersOnCandidate(
            cv,
            candidate,
            zxingConfig,
            tryDecode,
            quietZonePx,
            geometry,
          );
          if (hit) {
            return {
              hit,
              previewDataUrl: hit.enhancedDataUrl ?? previewDataUrl,
            };
          }
        }
      } finally {
        for (const mat of ownedDewarps) safeDelete(mat);
        safeDelete(geomMat);
      }
    }

    return { hit: null, previewDataUrl };
  } finally {
    safeDelete(src);
    safeDelete(gray);
    safeDelete(baseGray);
  }
}
