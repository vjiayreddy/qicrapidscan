import { describe, expect, it } from "vitest";
import type { BarcodeResult } from "../types/barcode.types.js";
import { DuplicateFilter } from "./DuplicateFilter.js";

function result(text: string, id = "track-1"): BarcodeResult {
  return {
    id,
    text,
    format: "QR_CODE",
    timestamp: 0,
  };
}

describe("DuplicateFilter", () => {
  it("keys on format:text, not track id", () => {
    const filter = new DuplicateFilter(true, 1000);
    expect(filter.filter([result("a", "track-1")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a", "track-2")], 1500)).toHaveLength(0);
    expect(filter.filter([result("a", "track-3")], 2100)).toHaveLength(1);
  });

  it("suppresses duplicates within cooldown", () => {
    const filter = new DuplicateFilter(true, 1000);
    expect(filter.filter([result("a")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a")], 1500)).toHaveLength(0);
    expect(filter.filter([result("a")], 2100)).toHaveLength(1);
  });

  it("once mode never re-accepts the same value", () => {
    const filter = new DuplicateFilter(true, 1000, "once");
    expect(filter.filter([result("a")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a")], 99999)).toHaveLength(0);
    expect(filter.filter([result("b")], 99999)).toHaveLength(1);
  });

  it("can be disabled", () => {
    const filter = new DuplicateFilter(false, 1000);
    expect(filter.filter([result("a")], 1000)).toHaveLength(1);
    expect(filter.filter([result("a")], 1001)).toHaveLength(1);
  });

  it("seed marks values as already seen", () => {
    const filter = new DuplicateFilter(true, 1000, "once");
    filter.seed(["QR_CODE:a"]);
    expect(filter.filter([result("a")], 1000)).toHaveLength(0);
    expect(filter.filter([result("b")], 1000)).toHaveLength(1);
  });
});
