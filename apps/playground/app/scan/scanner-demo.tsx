"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BarcodeResult } from "@qicrapidscan/core";
import {
  ALL_SUPPORTED_FORMATS,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
} from "@qicrapidscan/core";
import {
  BarcodeScanner,
  DEFAULT_ROI,
  ScanGuide,
  ScanOverlay,
  useBarcodeScanner,
  useElementSize,
  type RoiRect,
} from "@qicrapidscan/react";
import "@qicrapidscan/react/styles.css";

type DemoMode = "component" | "hook" | "upload";
type FormatMode = "all" | "1d" | "2d";

/** Live camera: single-decode + modest downscale; core also bands formats ≤4/frame. */
const LIVE_PERFORMANCE = {
  scanInterval: 150,
  maxWidth: 800,
  maxHeight: 450,
  tryHarder: false,
  liveFormatBanding: true,
} as const;

/** Image upload can afford a fuller multi-detect budget (one-shot). */
const UPLOAD_DETECTION = {
  multiple: true,
  maxResults: 10,
  maxRegions: 12,
  maxDepth: 2,
  maxTimeMs: 400,
} as const;

function formatsFor(mode: FormatMode) {
  if (mode === "1d") return [...ONE_D_FORMATS];
  if (mode === "2d") return [...TWO_D_FORMATS];
  return [...ALL_SUPPORTED_FORMATS];
}

export function ScannerDemo() {
  const [mode, setMode] = useState<DemoMode>("component");
  const [formatMode, setFormatMode] = useState<FormatMode>("all");
  const [log, setLog] = useState<BarcodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roi, setRoi] = useState<RoiRect>(DEFAULT_ROI);
  const [editingRoi, setEditingRoi] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<BarcodeResult[]>([]);
  const [uploadSize, setUploadSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  const formats = useMemo(() => formatsFor(formatMode), [formatMode]);
  const hookFrameRef = useRef<HTMLDivElement | null>(null);
  const uploadFrameRef = useRef<HTMLDivElement | null>(null);
  const hookFrameSize = useElementSize(hookFrameRef);
  const uploadFrameSize = useElementSize(uploadFrameRef);

  const appendLog = useCallback((results: BarcodeResult[]) => {
    setLog((prev) => [...results, ...prev].slice(0, 20));
  }, []);

  const live = useBarcodeScanner({
    formats,
    // Single full-frame decode — multi-region tiling is too heavy for live 1D/1D+2D.
    detection: { multiple: false },
    performance: { ...LIVE_PERFORMANCE },
    autoStart: false,
    onResult: appendLog,
    onError: (err) => setError(err.message),
  });

  const upload = useBarcodeScanner({
    formats,
    detection: { ...UPLOAD_DETECTION },
    performance: { maxWidth: 1280, maxHeight: 720 },
    autoStart: false,
    onResult: appendLog,
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    setUploadResults([]);
  }, [formatMode]);

  useEffect(() => {
    const video = live.videoRef.current;
    if (!video) return;
    const sync = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoSize((prev) =>
          prev.width === video.videoWidth && prev.height === video.videoHeight
            ? prev
            : { width: video.videoWidth, height: video.videoHeight },
        );
      }
    };
    sync();
    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("playing", sync);
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("playing", sync);
    };
  }, [live.videoRef, live.isScanning]);

  const onUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      setUploadResults([]);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [upload],
  );

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    };
  }, [uploadPreview]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setMode("component")}>
          Component API
        </button>
        <button type="button" onClick={() => setMode("hook")}>
          Hook API
        </button>
        <button type="button" onClick={() => setMode("upload")}>
          Image upload
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#555", fontSize: 14 }}>Formats:</span>
        <button type="button" onClick={() => setFormatMode("all")}>
          1D + 2D
        </button>
        <button type="button" onClick={() => setFormatMode("1d")}>
          1D only
        </button>
        <button type="button" onClick={() => setFormatMode("2d")}>
          2D only
        </button>
        {mode === "component" || mode === "hook" ? (
          <button type="button" onClick={() => setEditingRoi((v) => !v)}>
            {editingRoi ? "Done editing ROI" : "Edit ROI"}
          </button>
        ) : null}
      </div>

      {mode === "component" ? (
        <BarcodeScanner
          key={`component-${formatMode}`}
          formats={formats}
          multiple={false}
          performance={{ ...LIVE_PERFORMANCE }}
          autoStart
          showGuide
          showOverlay
          roi={roi}
          guideEditing={editingRoi}
          onRoiChange={setRoi}
          onResult={appendLog}
          onError={(err) => setError(err.message)}
          style={{ borderRadius: 8, overflow: "hidden", aspectRatio: "4 / 3" }}
          videoStyle={{ aspectRatio: "4 / 3", objectFit: "cover" }}
        />
      ) : null}

      {mode === "hook" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div
            ref={hookFrameRef}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 8,
              aspectRatio: "4 / 3",
              background: "#111",
            }}
          >
            <video
              ref={live.videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <ScanGuide
              roi={roi}
              editing={editingRoi}
              onRoiChange={setRoi}
            />
            <ScanOverlay
              results={live.overlayResults}
              sourceWidth={videoSize.width}
              sourceHeight={videoSize.height}
              containerWidth={hookFrameSize.width}
              containerHeight={hookFrameSize.height}
              objectFit="cover"
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void live.start()}>
              Start
            </button>
            <button type="button" onClick={() => void live.stop()}>
              Stop
            </button>
            <button type="button" onClick={() => live.pause()}>
              Pause
            </button>
            <button type="button" onClick={() => live.resume()}>
              Resume
            </button>
          </div>
          <p style={{ margin: 0, color: "#666" }}>
            Scanning: {live.isScanning ? "yes" : "no"}
          </p>
        </div>
      ) : null}

      {mode === "upload" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              void onUploadFile(event.target.files?.[0] ?? null);
            }}
          />
          <div
            ref={uploadFrameRef}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 8,
              background: "#111",
              minHeight: 200,
            }}
          >
            {uploadPreview ? (
              <img
                src={uploadPreview}
                alt="Upload preview"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                }}
              />
            ) : (
              <p style={{ color: "#aaa", padding: 24, margin: 0 }}>
                Choose an image with 1D or 2D barcodes.
              </p>
            )}
            <ScanOverlay
              results={uploadResults}
              sourceWidth={uploadSize.width}
              sourceHeight={uploadSize.height}
              containerWidth={uploadFrameSize.width}
              containerHeight={uploadFrameSize.height}
              objectFit="contain"
            />
          </div>
          {uploadResults.length > 0 ? (
            <p style={{ margin: 0, color: "#007d48" }}>
              Found {uploadResults.length} barcode
              {uploadResults.length === 1 ? "" : "s"} in image.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p style={{ color: "#b00020", margin: 0 }}>Error: {error}</p>
      ) : null}

      <section>
        <h2 style={{ fontSize: 18 }}>Results</h2>
        {log.length === 0 ? (
          <p style={{ color: "#777" }}>No barcodes yet.</p>
        ) : (
          <ol>
            {log.map((item, index) => (
              <li key={`${item.id}-${item.timestamp}-${index}`}>
                <strong>{item.format}</strong>: {item.text}
              </li>
            ))}
          </ol>
        )}
      </section>
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
