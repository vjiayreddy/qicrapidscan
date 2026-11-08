import { describe, expect, it } from "vitest";
import { BarcodeError } from "../errors/BarcodeError.js";
import { resolveOptions } from "./validateOptions.js";

describe("resolveOptions", () => {
  it("applies defaults", () => {
    const resolved = resolveOptions();
    expect(resolved.formats).toContain("QR_CODE");
    expect(resolved.performance.useWorker).toBe(false);
    expect(resolved.detection.multiple).toBe(false);
    expect(resolved.performance.scanInterval).toBe(150);
    expect(resolved.performance.maxWidth).toBe(1280);
    expect(resolved.performance.maxHeight).toBe(720);
    expect(resolved.performance.tryHarder).toBe(true);
    expect(resolved.performance.alsoInverted).toBe(true);
    expect(resolved.performance.multiScale).toBe(true);
    expect(resolved.performance.rotationRetry).toBe(true);
    expect(resolved.performance.imageEnhancement).toBe(true);
    expect(resolved.performance.liveFormatBanding).toBe(true);
    expect(resolved.performance.liveZoom).toBe(true);
    expect(resolved.performance.liveZoomCropRatio).toBe(0.55);
    expect(resolved.performance.liveZoomScale).toBe(2);
    expect(resolved.formats).toContain("CODABAR");
    expect(resolved.detection.maxTimeMs).toBe(250);
    expect(resolved.duplicateFilter.mode).toBe("cooldown");
    expect(resolved.captureCrop).toBe(false);
  });

  it("rejects invalid liveZoomCropRatio", () => {
    expect(() =>
      resolveOptions({ performance: { liveZoomCropRatio: 0.1 } }),
    ).toThrow(BarcodeError);
  });

  it("resolves once-mode duplicate filter", () => {
    const resolved = resolveOptions({
      duplicateFilter: { mode: "once" },
      captureCrop: true,
    });
    expect(resolved.duplicateFilter.mode).toBe("once");
    expect(resolved.captureCrop).toBe(true);
  });

  it("rejects negative scanInterval", () => {
    expect(() =>
      resolveOptions({ performance: { scanInterval: -1 } }),
    ).toThrow(BarcodeError);
  });
});
