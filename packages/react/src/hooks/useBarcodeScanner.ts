"use client";

import {
  BarcodeScanner,
  type BarcodeResult,
  type BarcodeScannerOptions,
  type CameraDevice,
} from "@qicrapidscan/core";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseBarcodeScannerOptions extends BarcodeScannerOptions {
  /** When true, start camera as soon as videoRef is attached and effect runs. */
  autoStart?: boolean;
  onResult?: (results: BarcodeResult[]) => void;
  onError?: (error: Error) => void;
}

export interface UseBarcodeScannerResult {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  scanImage: (
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | Blob,
  ) => Promise<BarcodeResult[]>;
  getCameras: () => Promise<CameraDevice[]>;
  switchCamera: (deviceId: string) => Promise<void>;
  results: BarcodeResult[];
  isScanning: boolean;
  error: Error | null;
  clearError: () => void;
  clearResults: () => void;
}

function optionsKey(options: UseBarcodeScannerOptions): string {
  const { autoStart: _a, onResult: _r, onError: _e, ...rest } = options;
  return JSON.stringify(rest);
}

/**
 * Owns a core `BarcodeScanner` instance for the component lifetime.
 * Strict Mode safe: destroy on cleanup; recreate on remount.
 */
export function useBarcodeScanner(
  options: UseBarcodeScannerOptions = {},
): UseBarcodeScannerResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<BarcodeScanner | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [results, setResults] = useState<BarcodeResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const key = optionsKey(options);
  const autoStart = options.autoStart ?? false;

  useEffect(() => {
    const { autoStart: _ignored, onResult, onError, ...scannerOptions } =
      optionsRef.current;
    void onResult;
    void onError;

    const scanner = new BarcodeScanner(scannerOptions);
    scannerRef.current = scanner;

    const offResult = scanner.on("result", (next) => {
      setResults((prev) => [...next, ...prev].slice(0, 50));
      optionsRef.current.onResult?.(next);
    });
    const offError = scanner.on("error", (err) => {
      setError(err);
      setIsScanning(false);
      optionsRef.current.onError?.(err);
    });

    let cancelled = false;

    async function maybeAutoStart() {
      if (!autoStart || cancelled) return;
      // Wait a tick so ref from JSX has attached in the same commit.
      await Promise.resolve();
      const video = videoRef.current;
      if (!video || cancelled) return;
      try {
        await scanner.start(video);
        if (!cancelled) setIsScanning(true);
      } catch (err) {
        if (!cancelled) {
          const mapped = err instanceof Error ? err : new Error(String(err));
          setError(mapped);
          setIsScanning(false);
          optionsRef.current.onError?.(mapped);
        }
      }
    }

    void maybeAutoStart();

    return () => {
      cancelled = true;
      offResult();
      offError();
      setIsScanning(false);
      void scanner.destroy();
      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }
    };
  }, [key, autoStart]);

  const start = useCallback(async () => {
    const scanner = scannerRef.current;
    const video = videoRef.current;
    if (!scanner) throw new Error("Scanner is not ready.");
    if (!video) throw new Error("videoRef is not attached to an HTMLVideoElement.");
    setError(null);
    await scanner.start(video);
    setIsScanning(true);
  }, []);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    await scanner.stop();
    setIsScanning(false);
  }, []);

  const pause = useCallback(() => {
    scannerRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    scannerRef.current?.resume();
  }, []);

  const scanImage = useCallback(
    async (
      source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | Blob,
    ) => {
      const scanner = scannerRef.current;
      if (!scanner) throw new Error("Scanner is not ready.");
      setError(null);
      return scanner.scanImage(source);
    },
    [],
  );

  const getCameras = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) throw new Error("Scanner is not ready.");
    return scanner.getCameras();
  }, []);

  const switchCamera = useCallback(async (deviceId: string) => {
    const scanner = scannerRef.current;
    if (!scanner) throw new Error("Scanner is not ready.");
    await scanner.switchCamera(deviceId);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearResults = useCallback(() => setResults([]), []);

  return {
    videoRef,
    start,
    stop,
    pause,
    resume,
    scanImage,
    getCameras,
    switchCamera,
    results,
    isScanning,
    error,
    clearError,
    clearResults,
  };
}
