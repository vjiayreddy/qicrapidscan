"use client";

import type {
  BarcodeFormat,
  BarcodeResult,
  BarcodeScannerOptions,
} from "@qicrapidscan/core";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner.js";
import { useElementSize } from "../hooks/useElementSize.js";
import { DEFAULT_ROI, ScanGuide, type RoiRect } from "./ScanGuide.js";
import { ScanOverlay } from "./ScanOverlay.js";

export interface BarcodeScannerProps {
  formats?: BarcodeFormat[];
  multiple?: boolean;
  facingMode?: "user" | "environment";
  autoStart?: boolean;
  /** Extra detection limits (merged with `multiple`). */
  detection?: BarcodeScannerOptions["detection"];
  /** Live-frame performance knobs (interval, downscale). */
  performance?: BarcodeScannerOptions["performance"];
  onResult?: (results: BarcodeResult[]) => void;
  onOverlay?: (results: BarcodeResult[]) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
  videoClassName?: string;
  videoStyle?: CSSProperties;
  /** Show ROI viewfinder guidelines over the live camera (default false). */
  showGuide?: boolean;
  /** Show AR detection polygons over the live camera (default false). */
  showOverlay?: boolean;
  /** ROI box in % of the stage. Defaults to `DEFAULT_ROI` when guide is shown. */
  roi?: RoiRect;
  /** When true with `showGuide`, enable drag/resize of the ROI. */
  guideEditing?: boolean;
  onRoiChange?: (roi: RoiRect) => void;
  guideLabel?: string;
  showLaser?: boolean;
  /** object-fit used for video + overlay alignment (default cover). */
  objectFit?: "contain" | "cover";
}

/**
 * Scanner surface with optional ROI guide and AR detection overlay.
 */
export function BarcodeScanner(props: BarcodeScannerProps) {
  const {
    formats,
    multiple = false,
    facingMode = "environment",
    autoStart = true,
    detection,
    performance,
    onResult,
    onOverlay,
    onError,
    className,
    style,
    videoClassName,
    videoStyle,
    showGuide = false,
    showOverlay = false,
    roi: roiProp,
    guideEditing = false,
    onRoiChange,
    guideLabel,
    showLaser = true,
    objectFit = "cover",
  } = props;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const frameSize = useElementSize(frameRef);
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [internalRoi, setInternalRoi] = useState<RoiRect>(DEFAULT_ROI);

  const roi = roiProp ?? internalRoi;

  const handleRoiChange = useCallback(
    (next: RoiRect) => {
      if (!roiProp) setInternalRoi(next);
      onRoiChange?.(next);
    },
    [onRoiChange, roiProp],
  );

  const { videoRef, isScanning, overlayResults } = useBarcodeScanner({
    formats,
    detection: { multiple, ...detection },
    performance,
    camera: { facingMode },
    autoStart,
    onResult,
    onOverlay,
    onError,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncSize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setSourceSize((prev) =>
          prev.width === video.videoWidth && prev.height === video.videoHeight
            ? prev
            : { width: video.videoWidth, height: video.videoHeight },
        );
      }
    };

    syncSize();
    video.addEventListener("loadedmetadata", syncSize);
    video.addEventListener("playing", syncSize);
    const interval = window.setInterval(syncSize, 500);
    return () => {
      video.removeEventListener("loadedmetadata", syncSize);
      video.removeEventListener("playing", syncSize);
      window.clearInterval(interval);
    };
  }, [videoRef, isScanning]);

  return (
    <div
      ref={frameRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
      data-qicrapidscan="scanner"
      data-scanning={isScanning ? "true" : "false"}
      role="region"
      aria-label="QicRapidScan barcode scanner"
    >
      <video
        ref={videoRef}
        className={videoClassName}
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          background: "#171717",
          display: "block",
          objectFit,
          ...videoStyle,
        }}
        muted
        playsInline
        autoPlay
      />
      {showGuide ? (
        <ScanGuide
          roi={roi}
          editing={guideEditing}
          onRoiChange={handleRoiChange}
          label={guideLabel}
          showLaser={showLaser}
        />
      ) : null}
      {showOverlay ? (
        <ScanOverlay
          results={overlayResults}
          sourceWidth={sourceSize.width}
          sourceHeight={sourceSize.height}
          containerWidth={frameSize.width}
          containerHeight={frameSize.height}
          objectFit={objectFit}
        />
      ) : null}
    </div>
  );
}
