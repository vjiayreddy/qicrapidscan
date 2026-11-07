import { describe, expect, it } from "vitest";
import { BarcodeError } from "../errors/BarcodeError.js";
import {
  ALL_SUPPORTED_FORMATS,
  assertSupportedFormats,
  DEFAULT_FORMATS,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
} from "./formats.js";

describe("formats", () => {
  it("accepts all documented formats", () => {
    expect(() => assertSupportedFormats([...ALL_SUPPORTED_FORMATS])).not.toThrow();
  });

  it("defaults to the full 1D + 2D set", () => {
    expect(DEFAULT_FORMATS).toEqual(ALL_SUPPORTED_FORMATS);
    expect(DEFAULT_FORMATS).toEqual([...ONE_D_FORMATS, ...TWO_D_FORMATS]);
  });

  it("rejects unknown formats", () => {
    expect(() => assertSupportedFormats(["FOO" as never])).toThrow(BarcodeError);
  });
});
