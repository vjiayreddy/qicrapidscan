import { describe, expect, it } from "vitest";
import type { BarcodeResult } from "../types/barcode.types.js";
import { dedupeResults } from "./Deduplicator.js";

function result(text: string, box?: BarcodeResult["boundingBox"]): BarcodeResult {
  return {
    id: `QR_CODE:${text}`,
    text,
    format: "QR_CODE",
    timestamp: 1,
    boundingBox: box,
  };
}

describe("dedupeResults", () => {
  it("collapses identical format+text", () => {
    const out = dedupeResults([
      result("a", { x: 0, y: 0, width: 10, height: 10 }),
      result("a", { x: 1, y: 1, width: 10, height: 10 }),
      result("b"),
    ]);
    expect(out.map((r) => r.text).sort()).toEqual(["a", "b"]);
  });
});
