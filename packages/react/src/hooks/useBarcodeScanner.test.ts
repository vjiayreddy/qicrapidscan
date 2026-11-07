import { describe, expect, it } from "vitest";
import { useBarcodeScanner } from "./useBarcodeScanner.js";

describe("useBarcodeScanner", () => {
  it("exports a function", () => {
    expect(typeof useBarcodeScanner).toBe("function");
  });
});
