import { describe, expect, it } from "vitest";
import { BarcodeError } from "../errors/BarcodeError.js";
import { ALL_SUPPORTED_FORMATS, assertSupportedFormats } from "./formats.js";

describe("formats", () => {
  it("accepts all documented formats", () => {
    expect(() => assertSupportedFormats([...ALL_SUPPORTED_FORMATS])).not.toThrow();
  });

  it("rejects unknown formats", () => {
    expect(() => assertSupportedFormats(["FOO" as never])).toThrow(BarcodeError);
  });
});
