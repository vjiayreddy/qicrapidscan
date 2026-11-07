import { describe, expect, it } from "vitest";
import type { BarcodeResult } from "../types/barcode.types.js";
import { DuplicateFilter } from "./DuplicateFilter.js";

function result(text: string): BarcodeResult {
  return {
    id: `QR_CODE:${text}`,
    text,
    format: "QR_CODE",
    timestamp: 0,
  };
}

describe("DuplicateFilter", () => {
  it("suppresses duplicates within cooldown", () => {
    const filter = new DuplicateFilter(true, 1000);
    expect(filter.filter([result("a")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a")], 1500)).toHaveLength(0);
    expect(filter.filter([result("a")], 2100)).toHaveLength(1);
  });

  it("can be disabled", () => {
    const filter = new DuplicateFilter(false, 1000);
    expect(filter.filter([result("a")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a")], 1001)).toHaveLength(1);
  });
});
