"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  BarcodeFormat,
  BarcodeResult,
  LocalizationRoi,
} from "@qicrapidscan/core";
import {
  exactRoiRect,
  mapLocalRectToSource,
  symbolKindFromLabel,
  tightenContentRectFromImageData,
  type TightenSymbolKind,
} from "@qicrapidscan/core";

const FORMAT_LABELS: Partial<Record<BarcodeFormat, string>> = {
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  ITF: "ITF",
  CODABAR: "Codabar",
  QR_CODE: "QR Code",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function thumbKindFromRoiOrFormat(
  label: string | undefined,
  format?: BarcodeFormat,
): TightenSymbolKind {
  if (label?.trim()) return symbolKindFromLabel(label);
  if (format === "DATA_MATRIX" || format === "QR_CODE" || format === "AZTEC") {
    return "matrix";
  }
  if (format === "PDF_417") return "pdf417";
  return "linear";
}

type CropThumb = {
  dataUrl: string;
  width: number;
  height: number;
  kind: TightenSymbolKind;
};

/** Fit crop pixels into a thumb slot while keeping the real aspect ratio. */
function fitThumbBox(
  width: number,
  height: number,
  kind: TightenSymbolKind,
): { width: number; height: number } {
  const maxW = kind === "matrix" ? 56 : kind === "pdf417" ? 100 : 112;
  const maxH = kind === "matrix" ? 56 : kind === "pdf417" ? 52 : 44;
  if (width <= 0 || height <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / width, maxH / height);
  return {
    width: Math.max(24, Math.round(width * scale)),
    height: Math.max(16, Math.round(height * scale)),
  };
}

/**
 * YOLO-box crop tightened per barcode type (linear / matrix / PDF417).
 * Falls back to the exact localization box when ink cannot be estimated.
 * Returns pixel size so the list thumb can size itself dynamically.
 */
function cropRoiToThumb(
  image: HTMLImageElement,
  roi: LocalizationRoi,
  options: { maxEdge?: number } = {},
): CropThumb | null {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih || roi.width <= 0 || roi.height <= 0) return null;

  const kind = symbolKindFromLabel(roi.label);
  const base =
    roi.crop && roi.crop.width >= 2 && roi.crop.height >= 2
      ? roi.crop
      : exactRoiRect(roi, iw, ih);

  let sx = Math.max(0, Math.min(Math.floor(base.x), iw - 1));
  let sy = Math.max(0, Math.min(Math.floor(base.y), ih - 1));
  let sw = Math.max(1, Math.min(Math.round(base.width), iw - sx));
  let sh = Math.max(1, Math.min(Math.round(base.height), ih - sy));
  if (sw < 2 || sh < 2) return null;

  // Analyze at native ROI resolution (capped) so projections stay sharp.
  const analyzeMax = 640;
  const analyzeScale = Math.min(1, analyzeMax / Math.max(sw, sh));
  const aw = Math.max(1, Math.round(sw * analyzeScale));
  const ah = Math.max(1, Math.round(sh * analyzeScale));
  const analyze = document.createElement("canvas");
  analyze.width = aw;
  analyze.height = ah;
  const analyzeCtx = analyze.getContext("2d", { willReadFrequently: true });
  if (analyzeCtx) {
    analyzeCtx.imageSmoothingEnabled = analyzeScale < 0.999;
    analyzeCtx.drawImage(image, sx, sy, sw, sh, 0, 0, aw, ah);
    try {
      const local = tightenContentRectFromImageData(
        analyzeCtx.getImageData(0, 0, aw, ah),
        { marginPx: 2, symbolKind: kind },
      );
      if (local) {
        const inv = analyzeScale > 0 ? 1 / analyzeScale : 1;
        const tightLocal = {
          x: Math.round(local.x * inv),
          y: Math.round(local.y * inv),
          width: Math.max(1, Math.round(local.width * inv)),
          height: Math.max(1, Math.round(local.height * inv)),
        };
        const tight = mapLocalRectToSource(tightLocal, {
          x: sx,
          y: sy,
          width: sw,
          height: sh,
        });
        sx = Math.max(0, Math.min(tight.x, iw - 1));
        sy = Math.max(0, Math.min(tight.y, ih - 1));
        sw = Math.max(1, Math.min(tight.width, iw - sx));
        sh = Math.max(1, Math.min(tight.height, ih - sy));
      }
    } catch {
      // Keep the YOLO box when canvas/pixel access fails.
    }
  }
  analyze.width = 0;
  analyze.height = 0;

  // Preserve real crop aspect — UI sizes the thumb from these pixels.
  const maxEdge = options.maxEdge ?? (kind === "matrix" ? 160 : 280);
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
  try {
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: outW,
      height: outH,
      kind,
    };
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function findRoiForResult(
  result: BarcodeResult,
  rois: LocalizationRoi[],
): LocalizationRoi | null {
  const text = result.text?.trim();
  if (!text) return null;
  return rois.find((roi) => roi.texts?.includes(text)) ?? null;
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load crop source image."));
    img.src = url;
  });
}

/** object-fit: contain rect inside a viewport. */
function containRect(
  vw: number,
  vh: number,
  iw: number,
  ih: number,
): { left: number; top: number; width: number; height: number } {
  if (vw <= 0 || vh <= 0 || iw <= 0 || ih <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(vw / iw, vh / ih);
  const width = iw * scale;
  const height = ih * scale;
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
  };
}

/** Prefer native camera app for still capture on phones / tablets. */
function prefersNativeStillCapture(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const uaMobile =
    /Android|iPhone|iPod|Mobile/i.test(ua) ||
    (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const touch = navigator.maxTouchPoints > 1;
  return uaMobile || (coarse && touch);
}

type UploadPanelProps = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  /** Staged hybrid progress text while busy. */
  busyMessage?: string | null;
  error: string | null;
  previewUrl: string | null;
  /** Annotated result image (source + baked orange landmarks). Preferred when set. */
  resultImageUrl?: string | null;
  results: BarcodeResult[];
  /** YOLO localization ROIs with per-box decode status. */
  localizationRois?: LocalizationRoi[];
  localizationLabel?: string | null;
  onFile: (file: File | null) => void;
  onClear: () => void;
  backAriaLabel?: string;
  backButtonLabel?: string;
  /** Opens the same Settings side drawer used by live camera. */
  onOpenSettings?: () => void;
};

export function UploadPanel(props: UploadPanelProps) {
  const {
    open,
    onClose,
    busy,
    busyMessage = "Localizing + decoding…",
    error,
    previewUrl,
    resultImageUrl = null,
    results,
    localizationRois = [],
    localizationLabel = null,
    onFile,
    onClear,
    backAriaLabel = "Back to live scan",
    backButtonLabel = "Back to camera",
    onOpenSettings,
  } = props;

  const hasLocalization = localizationRois.length > 0;
  const displayUrl = hasLocalization
    ? previewUrl
    : resultImageUrl || previewUrl;

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [nativeCapture, setNativeCapture] = useState(false);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [resultsOpen, setResultsOpen] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const decodedRois = useMemo(
    () => localizationRois.filter((roi) => roi.decoded === true),
    [localizationRois],
  );
  const failedRois = useMemo(
    () => localizationRois.filter((roi) => roi.decoded !== true),
    [localizationRois],
  );

  const resultsBadge =
    results.length + (hasLocalization ? failedRois.length : 0);

  const pickGallery = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const pickCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  useEffect(() => {
    setNativeCapture(prefersNativeStillCapture());
  }, []);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setResultsOpen(false);
  }, [previewUrl]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewUrl, open]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !previewUrl) return;
    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((current) => {
        const next = clamp(current + delta, MIN_ZOOM, MAX_ZOOM);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    element.addEventListener("wheel", onWheelNative, { passive: false });
    return () => element.removeEventListener("wheel", onWheelNative);
  }, [previewUrl]);

  const setZoomAround = useCallback(
    (nextZoom: number, clientX?: number, clientY?: number) => {
      const element = viewportRef.current;
      const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (!element) {
        setZoom(clamped);
        if (clamped <= 1) setPan({ x: 0, y: 0 });
        return;
      }
      const rect = element.getBoundingClientRect();
      const focusX = clientX == null ? rect.width / 2 : clientX - rect.left;
      const focusY = clientY == null ? rect.height / 2 : clientY - rect.top;
      const contentX = (focusX - pan.x) / zoom;
      const contentY = (focusY - pan.y) / zoom;
      setZoom(clamped);
      if (clamped <= 1) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan({
          x: focusX - contentX * clamped,
          y: focusY - contentY * clamped,
        });
      }
    },
    [pan.x, pan.y, zoom],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (zoom <= 1) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: pan.x,
        originY: pan.y,
      };
    },
    [pan.x, pan.y, zoom],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPan({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
    },
    [],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }, []);

  if (!open) return null;

  const sourceWidth = natural.width;
  const sourceHeight = natural.height;
  const fitted = containRect(
    viewportSize.width,
    viewportSize.height,
    sourceWidth || 1,
    sourceHeight || 1,
  );
  const strokeWidth =
    sourceWidth > 0
      ? Math.max(2, Math.min(sourceWidth, sourceHeight) / 180)
      : 2;

  return (
    <div className="pg-upload-panel" role="dialog" aria-modal="true">
      <header className="pg-upload-panel__header">
        <button
          type="button"
          className="pg-upload-panel__icon-btn"
          aria-label={backAriaLabel}
          onClick={onClose}
        >
          <ChevronLeftIcon />
        </button>
        <div className="pg-upload-panel__titles">
          <h2 className="pg-upload-panel__title">Scan from image</h2>
          <p className="pg-upload-panel__subtitle">
            Decode barcodes from a photo — no camera needed
          </p>
        </div>
        <div className="pg-upload-panel__header-actions">
          {previewUrl ? (
            <button
              type="button"
              className="pg-upload-panel__icon-btn pg-upload-panel__results-btn"
              aria-label="Open scan results"
              aria-expanded={resultsOpen}
              onClick={() => setResultsOpen(true)}
            >
              <ResultsIcon />
              {resultsBadge > 0 ? (
                <span className="pg-upload-panel__badge">
                  {resultsBadge > 99 ? "99+" : resultsBadge}
                </span>
              ) : null}
            </button>
          ) : null}
          {onOpenSettings ? (
            <button
              type="button"
              className="pg-upload-panel__icon-btn"
              aria-label="Open settings"
              onClick={onOpenSettings}
            >
              <SettingsIcon />
            </button>
          ) : null}
          {previewUrl ? (
            <button
              type="button"
              className="pg-upload-panel__text-btn"
              onClick={onClear}
            >
              Clear
            </button>
          ) : null}
        </div>
      </header>

      <div
        className={`pg-upload-panel__body${previewUrl ? " pg-upload-panel__body--viewer" : ""}`}
      >
        <input
          ref={galleryInputRef}
          className="pg-upload-panel__file"
          type="file"
          accept="image/*"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          className="pg-upload-panel__file"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />

        {!previewUrl ? (
          <div
            className={`pg-upload-drop${dragging ? " pg-upload-drop--active" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
          >
            <span className="pg-upload-drop__icon" aria-hidden>
              {nativeCapture ? <CameraIcon /> : <ImageIcon />}
            </span>
            <h3 className="pg-upload-drop__title">
              {nativeCapture ? "Capture or choose an image" : "Drop an image here"}
            </h3>
            <p className="pg-upload-drop__hint">
              {nativeCapture
                ? "On phones and tablets, Take photo opens the native camera. Gallery and Settings still work for 1D / 2D formats."
                : "PNG, JPG, or WebP with one or more barcodes. Use Settings to choose 1D / 2D formats. Live camera stays on the 1D / 2D modes."}
            </p>
            <div className="pg-upload-drop__actions">
              {nativeCapture ? (
                <button
                  type="button"
                  className="pg-btn pg-btn--primary pg-btn--lg"
                  onClick={pickCamera}
                >
                  Take photo
                </button>
              ) : null}
              <button
                type="button"
                className={`pg-btn pg-btn--lg ${nativeCapture ? "pg-btn--secondary" : "pg-btn--primary"}`}
                onClick={pickGallery}
              >
                {nativeCapture ? "Choose from gallery" : "Choose image"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pg-upload-viewer">
            <div
              ref={viewportRef}
              className="pg-upload-viewer__viewport"
              data-zoomed={zoom > 1 ? "true" : "false"}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div
                className="pg-upload-viewer__stage"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {fitted.width > 0 && sourceWidth > 0 ? (
                  <div
                    className="pg-upload-viewer__media"
                    style={{
                      left: fitted.left,
                      top: fitted.top,
                      width: fitted.width,
                      height: fitted.height,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayUrl!}
                      alt={
                        hasLocalization
                          ? "Uploaded image with localization boxes"
                          : "Uploaded barcode image"
                      }
                      draggable={false}
                      className="pg-upload-viewer__img"
                      onLoad={(event) => {
                        setNatural({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        });
                      }}
                    />
                    {!busy && hasLocalization ? (
                      <svg
                        className="pg-upload-viewer__overlay"
                        viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}
                        preserveAspectRatio="none"
                      >
                        {localizationRois.map((roi, index) => {
                          const ok =
                            roi.decoded === true &&
                            (roi.texts?.length ?? 0) > 0;
                          // Translucent box fill + centered ✓/✗ (no solid circle badge).
                          const boxSide = Math.min(
                            Math.max(1, roi.width),
                            Math.max(1, roi.height),
                          );
                          const markSize = Math.max(12, boxSide * 0.42);
                          const markCx = roi.x + roi.width / 2;
                          const markCy = roi.y + roi.height / 2;
                          const markStroke = Math.max(2, markSize * 0.16);
                          return (
                            <g key={`loc-${index}-${roi.x}-${roi.y}`}>
                              <rect
                                x={roi.x}
                                y={roi.y}
                                width={Math.max(1, roi.width)}
                                height={Math.max(1, roi.height)}
                                className={
                                  ok
                                    ? "pg-upload-result__box pg-upload-result__box--ok"
                                    : "pg-upload-result__box pg-upload-result__box--fail"
                                }
                                strokeWidth={strokeWidth}
                              />
                              {ok ? (
                                <path
                                  className="pg-upload-result__mark"
                                  d={`M ${markCx - markSize * 0.28} ${markCy + markSize * 0.02}
                                    L ${markCx - markSize * 0.06} ${markCy + markSize * 0.24}
                                    L ${markCx + markSize * 0.3} ${markCy - markSize * 0.22}`}
                                  strokeWidth={markStroke}
                                  fill="none"
                                />
                              ) : (
                                <path
                                  className="pg-upload-result__mark"
                                  d={`M ${markCx - markSize * 0.22} ${markCy - markSize * 0.22}
                                    L ${markCx + markSize * 0.22} ${markCy + markSize * 0.22}
                                    M ${markCx + markSize * 0.22} ${markCy - markSize * 0.22}
                                    L ${markCx - markSize * 0.22} ${markCy + markSize * 0.22}`}
                                  strokeWidth={markStroke}
                                  fill="none"
                                />
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    ) : null}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayUrl!}
                    alt="Uploaded barcode image"
                    draggable={false}
                    className="pg-upload-viewer__fallback"
                    onLoad={(event) => {
                      setNatural({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                  />
                )}
              </div>

              {busy ? (
                <div className="pg-upload-result__busy" role="status">
                  <strong>{busyMessage || "Localizing + decoding…"}</strong>
                </div>
              ) : null}

              {!busy && localizationLabel ? (
                <div className="pg-upload-result__chip" role="status">
                  {localizationLabel}
                </div>
              ) : null}
            </div>

            <div
              className="pg-upload-viewer__zoom"
              role="group"
              aria-label="Image zoom"
            >
              <button
                type="button"
                className="pg-upload-viewer__zoom-btn"
                aria-label="Zoom out"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => setZoomAround(zoom - ZOOM_STEP)}
              >
                −
              </button>
              <button
                type="button"
                className="pg-upload-viewer__zoom-btn pg-upload-viewer__zoom-btn--label"
                aria-label="Reset zoom"
                disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="pg-upload-viewer__zoom-btn"
                aria-label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => setZoomAround(zoom + ZOOM_STEP)}
              >
                +
              </button>
            </div>

            <div className="pg-upload-viewer__footer">
              {nativeCapture ? (
                <button
                  type="button"
                  className="pg-btn pg-btn--primary"
                  onClick={pickCamera}
                  disabled={busy}
                >
                  Retake photo
                </button>
              ) : null}
              <button
                type="button"
                className={`pg-btn ${nativeCapture ? "pg-btn--secondary" : "pg-btn--primary"}`}
                onClick={pickGallery}
                disabled={busy}
              >
                Choose another
              </button>
              <button
                type="button"
                className="pg-btn pg-btn--secondary"
                onClick={onClose}
              >
                {backButtonLabel}
              </button>
            </div>
          </div>
        )}

        {error ? (
          <p className="pg-status pg-status--error pg-upload-panel__error">
            {error}
          </p>
        ) : null}
      </div>

      {resultsOpen ? (
        <UploadResultsDrawer
          results={results}
          decodedRois={decodedRois}
          failedRois={failedRois}
          previewUrl={previewUrl}
          decodedCount={
            hasLocalization ? decodedRois.length : results.length
          }
          onClose={() => setResultsOpen(false)}
        />
      ) : null}
    </div>
  );
}

type UploadResultsDrawerProps = {
  results: BarcodeResult[];
  decodedRois: LocalizationRoi[];
  failedRois: LocalizationRoi[];
  previewUrl: string | null;
  decodedCount: number;
  onClose: () => void;
};

function UploadResultsDrawer({
  results,
  decodedRois,
  failedRois,
  previewUrl,
  decodedCount,
  onClose,
}: UploadResultsDrawerProps) {
  const [originalCrops, setOriginalCrops] = useState<Record<string, CropThumb>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    setOriginalCrops({});
    if (!previewUrl) return;
    if (decodedRois.length === 0 && failedRois.length === 0) return;

    void (async () => {
      try {
        const image = await loadImageFromUrl(previewUrl);
        if (cancelled) return;
        const next: Record<string, CropThumb> = {};
        failedRois.forEach((roi, index) => {
          const key = `fail-${index}-${roi.x}-${roi.y}`;
          const thumb = cropRoiToThumb(image, roi, { maxEdge: 256 });
          if (thumb) next[key] = thumb;
        });
        decodedRois.forEach((roi, index) => {
          const key = `ok-${index}-${roi.x}-${roi.y}`;
          const thumb = cropRoiToThumb(image, roi, { maxEdge: 256 });
          if (thumb) next[key] = thumb;
        });
        if (!cancelled) setOriginalCrops(next);
      } catch {
        if (!cancelled) setOriginalCrops({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewUrl, decodedRois, failedRois]);

  return (
    <div className="pg-upload-results-drawer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pg-upload-results-drawer__backdrop"
        aria-label="Close results"
        onClick={onClose}
      />
      <div className="pg-upload-results-drawer__panel">
        <header className="pg-upload-results-drawer__header">
          <button
            type="button"
            className="pg-upload-results-drawer__back"
            aria-label="Close results"
            onClick={onClose}
          >
            <ChevronLeftIcon />
          </button>
          <h2 className="pg-upload-results-drawer__title">Results</h2>
          <span className="pg-upload-results-drawer__summary">
            {decodedCount} ok · {failedRois.length} missed
          </span>
        </header>

        <div className="pg-upload-results-drawer__body">
          <section className="pg-upload-results-section">
            <h3 className="pg-upload-results-section__title pg-upload-results-section__title--ok">
              Decoded ({results.length})
            </h3>
            {results.length === 0 ? (
              <p className="pg-upload-results-section__empty">
                No barcodes decoded yet.
              </p>
            ) : (
              <ul className="pg-upload-result__list">
                {results.map((item, index) => {
                  const matchedRoi = findRoiForResult(item, decodedRois);
                  const matchedIndex = matchedRoi
                    ? decodedRois.indexOf(matchedRoi)
                    : -1;
                  const crop =
                    matchedIndex >= 0 && matchedRoi
                      ? originalCrops[
                          `ok-${matchedIndex}-${matchedRoi.x}-${matchedRoi.y}`
                        ]
                      : undefined;
                  const kind =
                    crop?.kind ??
                    thumbKindFromRoiOrFormat(matchedRoi?.label, item.format);
                  const box = crop
                    ? fitThumbBox(crop.width, crop.height, kind)
                    : fitThumbBox(52, 52, kind);
                  return (
                    <li
                      key={`${item.id}-${item.timestamp}-${index}`}
                      className="pg-upload-result__item"
                    >
                      <div
                        className="pg-upload-result__thumb"
                        style={{ width: box.width, height: box.height }}
                        aria-hidden
                      >
                        {crop ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={crop.dataUrl} alt="" />
                        ) : (
                          <span className="pg-upload-result__thumb-fallback">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <div className="pg-upload-result__body">
                        <span className="pg-upload-result__format">
                          {FORMAT_LABELS[item.format] ?? item.format}
                          <span className="pg-upload-result__index">
                            #{index + 1}
                          </span>
                        </span>
                        <span className="pg-upload-result__text">
                          {item.text}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pg-upload-results-section">
            <h3 className="pg-upload-results-section__title pg-upload-results-section__title--fail">
              Not decoded ({failedRois.length})
            </h3>
            {failedRois.length === 0 ? (
              <p className="pg-upload-results-section__empty">
                Every localized box was read successfully.
              </p>
            ) : (
              <ul className="pg-upload-result__list">
                {failedRois.map((roi, index) => {
                  const key = `fail-${index}-${roi.x}-${roi.y}`;
                  const crop = originalCrops[key];
                  const kind =
                    crop?.kind ?? thumbKindFromRoiOrFormat(roi.label);
                  const box = crop
                    ? fitThumbBox(crop.width, crop.height, kind)
                    : fitThumbBox(72, 40, kind);
                  return (
                    <li
                      key={key}
                      className="pg-upload-result__item pg-upload-result__item--fail"
                    >
                      <div
                        className="pg-upload-result__thumb pg-upload-result__thumb--fail"
                        style={{ width: box.width, height: box.height }}
                        aria-hidden
                      >
                        {crop ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={crop.dataUrl} alt="" />
                        ) : (
                          <FailMarkIcon />
                        )}
                      </div>
                      <div className="pg-upload-result__body">
                        <span className="pg-upload-result__format pg-upload-result__format--fail">
                          {roi.label?.trim()
                            ? `Localized ${roi.label}`
                            : "Localized box"}
                          <span className="pg-upload-result__index">
                            #{index + 1}
                          </span>
                        </span>
                        <span className="pg-upload-result__text">
                          Detected but not decoded
                          {typeof roi.score === "number"
                            ? ` · score ${(roi.score * 100).toFixed(0)}%`
                            : ""}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M5 16l4-4 3 3 3-4 4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5h6l1.5 2H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3.5L9 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h11M15 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM4 16h7M11 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M3.5 6.5h.01M3.5 12.5h.01M3.5 18.5h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FailMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#d30005" />
      <path
        d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
