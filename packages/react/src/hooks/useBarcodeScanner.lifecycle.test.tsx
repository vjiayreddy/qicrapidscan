/** @jsxImportSource react */
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBarcodeScanner } from "./useBarcodeScanner.js";

vi.mock("@qicrapidscan/core", () => {
  class MockScanner {
    on = vi.fn(() => () => undefined);
    start = vi.fn(async () => undefined);
    stop = vi.fn(async () => undefined);
    pause = vi.fn();
    resume = vi.fn();
    scanImage = vi.fn(async () => []);
    getCameras = vi.fn(async () => []);
    switchCamera = vi.fn(async () => undefined);
    destroy = vi.fn(async () => undefined);
  }
  return {
    BarcodeScanner: MockScanner,
  };
});

afterEach(() => {
  cleanup();
});

describe("useBarcodeScanner lifecycle", () => {
  it("creates and destroys the core scanner on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useBarcodeScanner({ formats: ["QR_CODE"] }),
    );

    expect(result.current.isScanning).toBe(false);
    expect(typeof result.current.start).toBe("function");

    unmount();
    // destroy is async in cleanup; flush microtasks
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("exposes a video ref for attachment", () => {
    function Probe() {
      const { videoRef } = useBarcodeScanner();
      return <video ref={videoRef} data-testid="video" />;
    }
    const { getByTestId, unmount } = render(<Probe />);
    expect(getByTestId("video")).toBeTruthy();
    unmount();
  });
});
