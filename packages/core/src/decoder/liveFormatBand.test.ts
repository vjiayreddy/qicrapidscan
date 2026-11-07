import { describe, expect, it } from "vitest";
import { ALL_SUPPORTED_FORMATS, ONE_D_FORMATS, TWO_D_FORMATS } from "./formats.js";
import { LIVE_FORMAT_BAND_TARGET, selectLiveFormatBand } from "./liveFormatBand.js";

describe("selectLiveFormatBand", () => {
  it("returns all formats when already within the live budget", () => {
    const band = selectLiveFormatBand(TWO_D_FORMATS, 0);
    expect(band.formats).toEqual([...TWO_D_FORMATS]);
    expect(band.formats.length).toBeLessThanOrEqual(LIVE_FORMAT_BAND_TARGET);
  });

  it("caps 1D+2D to four formats and rotates the remainder", () => {
    const first = selectLiveFormatBand(ALL_SUPPORTED_FORMATS, 0);
    const second = selectLiveFormatBand(ALL_SUPPORTED_FORMATS, first.nextCursor);

    expect(first.formats).toHaveLength(LIVE_FORMAT_BAND_TARGET);
    expect(second.formats).toHaveLength(LIVE_FORMAT_BAND_TARGET);
    expect(first.formats).toContain("QR_CODE");
    expect(first.formats).toContain("EAN_13");
    expect(first.formats).toContain("CODE_128");
    expect(second.formats.slice(0, 3)).toEqual(first.formats.slice(0, 3));
    expect(second.formats[3]).not.toEqual(first.formats[3]);
  });

  it("covers every 1D format across rotations", () => {
    const seen = new Set<string>();
    let cursor = 0;
    for (let i = 0; i < ONE_D_FORMATS.length * 2; i += 1) {
      const band = selectLiveFormatBand(ONE_D_FORMATS, cursor);
      cursor = band.nextCursor;
      for (const format of band.formats) seen.add(format);
    }
    expect([...seen].sort()).toEqual([...ONE_D_FORMATS].sort());
  });
});
