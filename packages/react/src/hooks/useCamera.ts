"use client";

import { BarcodeScanner, type CameraDevice } from "@qicrapidscan/core";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseCameraResult {
  cameras: CameraDevice[];
  activeDeviceId: string | null;
  refresh: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  error: Error | null;
}

/**
 * Enumerate cameras independently of a live scan session.
 * Note: browser labels often require a prior permission grant.
 */
export function useCamera(): UseCameraResult {
  const helperRef = useRef<BarcodeScanner | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const helper = new BarcodeScanner();
    helperRef.current = helper;
    return () => {
      void helper.destroy();
      if (helperRef.current === helper) helperRef.current = null;
    };
  }, []);

  const refresh = useCallback(async () => {
    const helper = helperRef.current;
    if (!helper) return;
    try {
      setError(null);
      const list = await helper.getCameras();
      setCameras(list);
      if (list[0] && !activeDeviceId) {
        setActiveDeviceId(list[0].deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [activeDeviceId]);

  const switchCamera = useCallback(async (deviceId: string) => {
    setActiveDeviceId(deviceId);
  }, []);

  return {
    cameras,
    activeDeviceId,
    refresh,
    switchCamera,
    error,
  };
}
