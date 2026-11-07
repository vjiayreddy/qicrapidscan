"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { BarcodeFormat, BarcodeResult } from "@qicrapidscan/core";
import { ALL_SUPPORTED_FORMATS } from "@qicrapidscan/core";
import {
  BarcodeScanner,
  useBarcodeScanner,
  useElementSize,
  type RoiRect,
} from "@qicrapidscan/react";
import "@qicrapidscan/react/styles.css";
import { SettingsDrawer, type BarcodeTab } from "./settings-drawer";
import { UploadPanel } from "./upload-panel";

type FacingMode = "user" | "environment";

const LIVE_PERFORMANCE = {
  scanInterval: 150,
  maxWidth: 800,
  maxHeight: 450,
  tryHarder: false,
  liveFormatBanding: true,
} as const;

const UPLOAD_DETECTION = {
  multiple: true,
  maxResults: 10,
  maxRegions: 12,
  maxDepth: 2,
  maxTimeMs: 400,
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

export function ScannerDemo() {
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const [latest, setLatest] = useState<BarcodeResult | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [roi, setRoi] = useState<RoiRect>(FINDER_ROI);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<BarcodeResult[]>([]);
  const [uploadSize, setUploadSize] = useState({ width: 0, height: 0 });

  const formats = useMemo(() => {
    const selected = ALL_SUPPORTED_FORMATS.filter((f) => enabledFormats.has(f));
    return selected.length > 0 ? selected : [...ALL_SUPPORTED_FORMATS];
  }, [enabledFormats]);

  const formatsKey = formats.join(",");
  const uploadFrameRef = useRef<HTMLDivElement | null>(null);
  const uploadFrameSize = useElementSize(uploadFrameRef);
  const beepRef = useRef(beepTone);
  beepRef.current = beepTone;

  const onLiveResult = useCallback((results: BarcodeResult[]) => {
    if (results.length === 0) return;
    if (beepRef.current) playBeep();
    setLatest(results[0] ?? null);
  }, []);

  const upload = useBarcodeScanner({
    formats,
    detection: { ...UPLOAD_DETECTION },
    performance: { maxWidth: 1280, maxHeight: 720 },
    autoStart: false,
    onError: (err) => setUploadError(err.message),
  });

  useEffect(() => {
    setUploadResults([]);
  }, [formatsKey]);

  useEffect(() => {
    if (!latest) return;
    const id = window.setTimeout(() => setLatest(null), 3200);
    return () => window.clearTimeout(id);
  }, [latest]);

  const clearUpload = useCallback(() => {
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setUploadResults([]);
    setUploadSize({ width: 0, height: 0 });
    setUploadError(null);
    setUploadBusy(false);
  }, []);

  const onUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploadError(null);
      setUploadResults([]);
      setUploadBusy(true);

      const url = URL.createObjectURL(file);
      setUploadPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const img = await loadImage(url);
        setUploadSize({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        const results = await upload.scanImage(img);
        setUploadResults(results);
        if (results.length > 0 && beepRef.current) playBeep();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploadBusy(false);
      }
    },
    [upload],
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

  const overlayOpen = drawerOpen || uploadOpen;

  return (
    <div className="pg-scan-hud">
      <div className="pg-scan-hud__stage">
        <BarcodeScanner
          key={`live-${formatsKey}-${facingMode}-${multiple}`}
          formats={formats}
          facingMode={facingMode}
          multiple={multiple}
          performance={{ ...LIVE_PERFORMANCE }}
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

        <div className="pg-scan-hud__chrome" aria-hidden={overlayOpen}>
          <header className="pg-scan-hud__top">
            <Link
              href="/"
              className="pg-scan-hud__icon-btn"
              aria-label="Back to home"
            >
              <HomeIcon />
            </Link>
            <div className="pg-scan-hud__top-right">
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
                onClick={() => setDrawerOpen(true)}
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
                setUploadOpen(true);
              }}
            >
              <GalleryIcon />
              <span>Upload image</span>
            </button>
          </div>
        </div>

        {latest && !overlayOpen ? (
          <div className="pg-scan-hud__toast" role="status">
            <span className="pg-scan-hud__toast-format">{latest.format}</span>
            <span className="pg-scan-hud__toast-text">{latest.text}</span>
          </div>
        ) : null}

        {liveError && !overlayOpen ? (
          <p className="pg-scan-hud__error" role="alert">
            {liveError}
          </p>
        ) : null}
      </div>

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        busy={uploadBusy}
        error={uploadError}
        previewUrl={uploadPreview}
        results={uploadResults}
        sourceSize={uploadSize}
        frameRef={uploadFrameRef}
        frameSize={uploadFrameSize}
        onFile={(file) => void onUploadFile(file)}
        onClear={clearUpload}
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

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
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
