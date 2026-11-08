"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { BarcodeFormat, BarcodeResult } from "@qicrapidscan/core";
import {
  ALL_SUPPORTED_FORMATS,
  annotateBarcodeImage,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
} from "@qicrapidscan/core";
import {
  BarcodeScanner,
  useBarcodeScanner,
  type RoiRect,
} from "@qicrapidscan/react";
import "@qicrapidscan/react/styles.css";
import { ModePicker, type DemoMode } from "./mode-picker";
import {
  LatestScanToast,
  ScanHistoryDrawer,
  scanValueKey,
  type ScanHistoryItem,
} from "./scan-history";
import { SettingsDrawer, type BarcodeTab } from "./settings-drawer";
import { UploadPanel } from "./upload-panel";

type FacingMode = "user" | "environment";

const LIVE_PERFORMANCE = {
  scanInterval: 120,
  maxWidth: 1600,
  maxHeight: 900,
  tryHarder: true,
  alsoInverted: true,
  imageEnhancement: true,
  liveFormatBanding: true,
  liveZoom: true,
  // Tighter center crop + stronger upscale for far / small codes.
  liveZoomCropRatio: 0.4,
  liveZoomScale: 3,
} as const;

const LIVE_CAMERA = {
  facingMode: "environment" as const,
  width: 1920,
  height: 1080,
};

const UPLOAD_DETECTION = {
  multiple: true,
  maxResults: 64,
  maxRegions: 48,
  maxDepth: 3,
  overlap: 0.25,
  // Dense Data Matrix packs + edge 1D need a longer tile budget.
  maxTimeMs: 8000,
} as const;

const UPLOAD_PERFORMANCE = {
  // Keep more resolution so tiny tray Data Matrices stay readable after downscale.
  maxWidth: 2560,
  maxHeight: 2560,
  tryHarder: true,
  alsoInverted: true,
  multiScale: true,
  rotationRetry: true,
  imageEnhancement: true,
} as const;

const FINDER_ROI: RoiRect = {
  left: 12,
  top: 22,
  width: 76,
  height: 48,
};

function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.13);
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    // Audio may be blocked; ignore.
  }
}

function formatsForMode(mode: DemoMode): Set<BarcodeFormat> {
  if (mode === "1d" || mode === "image-1d") return new Set(ONE_D_FORMATS);
  if (mode === "2d" || mode === "image-2d") return new Set(TWO_D_FORMATS);
  return new Set(ALL_SUPPORTED_FORMATS);
}

export function ScannerDemo() {
  const [demoMode, setDemoMode] = useState<DemoMode | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [multiple, setMultiple] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [editRoi, setEditRoi] = useState(false);
  const [beepTone, setBeepTone] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [barcodeTab, setBarcodeTab] = useState<BarcodeTab>("1d");
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [enabledFormats, setEnabledFormats] = useState(
    () => new Set<BarcodeFormat>(ALL_SUPPORTED_FORMATS),
  );
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [roi, setRoi] = useState<RoiRect>(FINDER_ROI);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadResultImage, setUploadResultImage] = useState<string | null>(
    null,
  );
  const [uploadResults, setUploadResults] = useState<BarcodeResult[]>([]);

  const formats = useMemo(() => {
    const selected = ALL_SUPPORTED_FORMATS.filter((f) => enabledFormats.has(f));
    return selected.length > 0 ? selected : [...ALL_SUPPORTED_FORMATS];
  }, [enabledFormats]);

  const formatsKey = formats.join(",");
  const beepRef = useRef(beepTone);
  beepRef.current = beepTone;
  const seenRef = useRef(new Set<string>());

  const seenKeys = useMemo(
    () => history.map((item) => scanValueKey(item)),
    [history],
  );

  const isLiveMode = demoMode === "1d" || demoMode === "2d";
  const isImageMode =
    demoMode === "image" ||
    demoMode === "image-1d" ||
    demoMode === "image-2d";

  const onLiveResult = useCallback((results: BarcodeResult[]) => {
    if (results.length === 0) return;

    const fresh: ScanHistoryItem[] = [];
    for (const result of results) {
      const key = scanValueKey(result);
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      fresh.push({ ...result, scannedAt: Date.now() });
    }
    if (fresh.length === 0) return;

    if (beepRef.current) playBeep();
    setHistory((prev) => [...fresh, ...prev].slice(0, 50));
  }, []);

  const clearHistory = useCallback(() => {
    seenRef.current.clear();
    setHistory([]);
  }, []);

  const upload = useBarcodeScanner({
    formats,
    detection: { ...UPLOAD_DETECTION, multiple },
    performance: { ...UPLOAD_PERFORMANCE },
    captureCrop: true,
    autoStart: false,
    onError: (err) => setUploadError(err.message),
  });

  const uploadPreviewRef = useRef<string | null>(null);
  uploadPreviewRef.current = uploadPreview;

  const applyUploadResults = useCallback(
    (img: HTMLImageElement, results: BarcodeResult[]) => {
      setUploadResults(results);
      if (results.length > 0 && showOverlay) {
        setUploadResultImage(
          annotateBarcodeImage(img, results, {
            maxEdge: 2048,
            showLandmarks: true,
            showIndices: true,
          }),
        );
      } else {
        setUploadResultImage(null);
      }
    },
    [showOverlay],
  );

  useEffect(() => {
    setUploadResults([]);
    setUploadResultImage(null);
  }, [formatsKey]);

  // Re-decode the current image when formats / multiple change.
  useEffect(() => {
    const url = uploadPreviewRef.current;
    if (!url) return;
    let cancelled = false;
    void (async () => {
      setUploadBusy(true);
      setUploadError(null);
      try {
        const img = await loadImage(url);
        if (cancelled) return;
        const results = await upload.scanImage(img);
        if (cancelled) return;
        applyUploadResults(img, results);
      } catch (err) {
        if (!cancelled) {
          setUploadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setUploadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-scan on format/multiple only
  }, [formatsKey, multiple, applyUploadResults]);

  // Rebuild annotated result image when overlay toggle changes (no re-decode).
  useEffect(() => {
    const url = uploadPreviewRef.current;
    if (!url || uploadResults.length === 0) {
      setUploadResultImage(null);
      return;
    }
    if (!showOverlay) {
      setUploadResultImage(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const img = await loadImage(url);
      if (cancelled) return;
      setUploadResultImage(
        annotateBarcodeImage(img, uploadResults, {
          maxEdge: 2048,
          showLandmarks: true,
          showIndices: true,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [showOverlay, uploadResults]);

  const clearUpload = useCallback(() => {
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploadResults([]);
    setUploadResultImage(null);
    setUploadError(null);
    setUploadBusy(false);
  }, []);

  const returnToPicker = useCallback(() => {
    setDemoMode(null);
    setDrawerOpen(false);
    setHistoryOpen(false);
    setUploadOpen(false);
    setLiveError(null);
    clearHistory();
    setEditRoi(false);
    clearUpload();
  }, [clearUpload, clearHistory]);

  const selectMode = useCallback((mode: DemoMode) => {
    const image =
      mode === "image" || mode === "image-1d" || mode === "image-2d";
    setEnabledFormats(formatsForMode(mode));
    setBarcodeTab(
      mode === "2d" || mode === "image-2d" ? "2d" : "1d",
    );
    setShowAllFormats(false);
    // Image multi-detect on by default; live stays single unless toggled.
    setMultiple(image);
    setLiveError(null);
    seenRef.current.clear();
    setHistory([]);
    setDrawerOpen(false);
    setHistoryOpen(false);
    setUploadOpen(image);
    setDemoMode(mode);
  }, []);

  const onUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploadError(null);
      setUploadResults([]);
      setUploadResultImage(null);
      setUploadBusy(true);

      const url = URL.createObjectURL(file);
      setUploadPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const img = await loadImage(url);
        const results = await upload.scanImage(img);
        applyUploadResults(img, results);
        if (results.length > 0 && beepRef.current) playBeep();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadBusy(false);
      }
    },
    [upload, applyUploadResults],
  );

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  const flipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const toggleFormat = (format: BarcodeFormat) => {
    setEnabledFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  };

  const enableAll = (list: readonly BarcodeFormat[], enabled: boolean) => {
    setEnabledFormats((prev) => {
      const next = new Set(prev);
      for (const format of list) {
        if (enabled) next.add(format);
        else next.delete(format);
      }
      return next;
    });
  };

  if (demoMode === null) {
    return <ModePicker onSelect={selectMode} />;
  }

  const overlayOpen = drawerOpen || historyOpen || uploadOpen;
  const latest = history[0] ?? null;

  return (
    <div className="pg-scan-hud">
      <div className="pg-scan-hud__stage">
        {isLiveMode ? (
          <BarcodeScanner
            key={`live-${demoMode}-${formatsKey}-${facingMode}-${multiple}`}
            formats={formats}
            facingMode={facingMode}
            multiple={multiple}
            detection={
              multiple
                ? {
                    multiple: true,
                    maxResults: 10,
                    maxRegions: 12,
                    maxDepth: 2,
                    maxTimeMs: 280,
                  }
                : undefined
            }
            performance={{ ...LIVE_PERFORMANCE }}
            camera={{ ...LIVE_CAMERA, facingMode }}
            duplicateFilter={{ enabled: true, mode: "once" }}
            captureCrop
            seenKeys={seenKeys}
            autoStart
            showGuide={showGuide}
            showOverlay={showOverlay}
            showLaser={showGuide && !editRoi}
            roi={roi}
            guideEditing={editRoi}
            onRoiChange={setRoi}
            guideLabel="Move the finder over a barcode"
            onResult={onLiveResult}
            onError={(err) => setLiveError(err.message)}
            className="pg-scan-hud__scanner"
            style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
            videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="pg-scan-hud__image-shell" aria-hidden />
        )}

        {isLiveMode ? (
          <div className="pg-scan-hud__chrome" aria-hidden={overlayOpen}>
            <header className="pg-scan-hud__top">
              <button
                type="button"
                className="pg-scan-hud__icon-btn"
                aria-label="Back to mode picker"
                onClick={returnToPicker}
              >
                <BackIcon />
              </button>
              <div className="pg-scan-hud__top-right">
                <button
                  type="button"
                  className="pg-scan-hud__history-btn"
                  aria-label="Open scan history"
                  aria-expanded={historyOpen}
                  onClick={() => {
                    setDrawerOpen(false);
                    setUploadOpen(false);
                    setHistoryOpen(true);
                  }}
                >
                  <HistoryIcon />
                  <span>History</span>
                  {history.length > 0 ? (
                    <span className="pg-scan-hud__history-count">
                      {history.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="pg-scan-hud__icon-btn"
                  aria-label="Flip camera"
                  onClick={flipCamera}
                >
                  <FlipCameraIcon />
                </button>
                <button
                  type="button"
                  className="pg-scan-hud__icon-btn"
                  aria-label="Open settings"
                  aria-expanded={drawerOpen}
                  onClick={() => {
                    setHistoryOpen(false);
                    setDrawerOpen(true);
                  }}
                >
                  <SettingsIcon />
                </button>
              </div>
            </header>

            <Link href="/docs" className="pg-scan-hud__sdk-pill">
              Try the SDK in your project ↗
            </Link>

            <div className="pg-scan-hud__bottom">
              <button
                type="button"
                className="pg-scan-hud__upload-btn"
                onClick={() => {
                  setDrawerOpen(false);
                  setHistoryOpen(false);
                  setUploadOpen(true);
                }}
              >
                <GalleryIcon />
                <span>Upload image</span>
              </button>
            </div>
          </div>
        ) : null}

        {latest && isLiveMode && !overlayOpen ? (
          <LatestScanToast item={latest} />
        ) : null}

        {liveError && isLiveMode && !overlayOpen ? (
          <p className="pg-scan-hud__error" role="alert">
            {liveError}
          </p>
        ) : null}
      </div>

      {isLiveMode ? (
        <ScanHistoryDrawer
          open={historyOpen}
          items={history}
          onClose={() => setHistoryOpen(false)}
          onClear={clearHistory}
        />
      ) : null}

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant={isImageMode || uploadOpen ? "image" : "live"}
        multiple={multiple}
        onMultipleChange={setMultiple}
        showGuide={showGuide}
        onShowGuideChange={setShowGuide}
        editRoi={editRoi}
        onEditRoiChange={(value) => {
          setEditRoi(value);
          if (value) setDrawerOpen(false);
        }}
        beepTone={beepTone}
        onBeepToneChange={setBeepTone}
        showOverlay={showOverlay}
        onShowOverlayChange={setShowOverlay}
        barcodeTab={barcodeTab}
        onBarcodeTabChange={setBarcodeTab}
        enabledFormats={enabledFormats}
        onToggleFormat={toggleFormat}
        onEnableAll={enableAll}
        showAllFormats={showAllFormats}
        onShowAllFormatsChange={setShowAllFormats}
      />

      <UploadPanel
        open={uploadOpen || isImageMode}
        onClose={() => {
          if (isImageMode) {
            returnToPicker();
            return;
          }
          setUploadOpen(false);
        }}
        busy={uploadBusy}
        error={uploadError}
        previewUrl={uploadPreview}
        resultImageUrl={uploadResultImage}
        results={uploadResults}
        onFile={(file) => void onUploadFile(file)}
        onClear={clearUpload}
        backAriaLabel={
          isImageMode ? "Back to mode picker" : "Back to live scan"
        }
        backButtonLabel={isImageMode ? "Back to menu" : "Back to camera"}
        onOpenSettings={() => {
          setHistoryOpen(false);
          setDrawerOpen(true);
        }}
      />
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = url;
  });
}

function BackIcon() {
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

function FlipCameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4h6l1.5 2H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5L9 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5a3.5 3.5 0 1 1-2.8 5.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12.5 9.8 9.8 12.5 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M3.5 4.5v4h4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function GalleryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path
        d="M5 16l4-4 3 3 3-4 4 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
