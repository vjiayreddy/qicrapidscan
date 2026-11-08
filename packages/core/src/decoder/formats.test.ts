import { describe, expect, it } from "vitest";
import {
  ALL_SUPPORTED_FORMATS,
  DEFAULT_FORMATS,
  ONE_D_FORMATS,
  assertSupportedFormats,
} from "./formats.js";
import { BarcodeError } from "../errors/BarcodeError.js";

describe("formats", () => {
  it("includes CODABAR in the default 1D set", () => {
    expect(ONE_D_FORMATS).toContain("CODABAR");
    expect(DEFAULT_FORMATS).toContain("CODABAR");
    expect(ALL_SUPPORTED_FORMATS).toContain("CODABAR");
  });

  it("rejects unknown formats", () => {
    expect(() =>
      assertSupportedFormats(["NOT_A_FORMAT" as never]),
    ).toThrow(BarcodeError);
  });
});
