"use client";

import type { BarcodeFormat, BarcodeResult } from "@qicrapidscan/core";
import type { CSSProperties } from "react";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner.js";

export interface BarcodeScannerProps {
  formats?: BarcodeFormat[];
  multiple?: boolean;
  facingMode?: "user" | "environment";
  autoStart?: boolean;
  onResult?: (results: BarcodeResult[]) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
  videoClassName?: string;
  videoStyle?: CSSProperties;
}

/**
 * Minimal customizable scanner surface — video only, no forced chrome.
 */
export function BarcodeScanner(props: BarcodeScannerProps) {
  const {
    formats,
    multiple = false,
    facingMode = "environment",
    autoStart = true,
    onResult,
    onError,
    className,
    style,
    videoClassName,
    videoStyle,
  } = props;

  const { videoRef, isScanning } = useBarcodeScanner({
    formats,
    detection: { multiple },
    camera: { facingMode },
    autoStart,
    onResult,
    onError,
  });

  return (
    <div
      className={className}
      style={style}
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
          background: "#111",
          display: "block",
          ...videoStyle,
        }}
        muted
        playsInline
        autoPlay
      />
    </div>
  );
}
