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
    expect(resolved.performance.maxWidth).toBe(960);
    expect(resolved.performance.tryHarder).toBe(false);
    expect(resolved.performance.liveFormatBanding).toBe(true);
    expect(resolved.detection.maxTimeMs).toBe(120);
    expect(resolved.duplicateFilter.mode).toBe("cooldown");
    expect(resolved.captureCrop).toBe(false);
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
