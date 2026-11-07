import type { BarcodeResult } from "../types/barcode.types.js";
import { boxesOverlap } from "./coordinates.js";

function keyOf(result: BarcodeResult): string {
  return `${result.format}:${result.text}`;
}

/**
 * Deduplicate multi-region hits.
 * Same format+text collapses to one result; near-identical boxes also collapse.
 */
export function dedupeResults(results: BarcodeResult[]): BarcodeResult[] {
  const byKey = new Map<string, BarcodeResult>();

  for (const result of results) {
    const key = keyOf(result);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, result);
      continue;
    }

    // Prefer the hit that has geometry when available.
    const existingScore = (existing.boundingBox ? 2 : 0) + (existing.points?.length ?? 0);
    const nextScore = (result.boundingBox ? 2 : 0) + (result.points?.length ?? 0);
    if (nextScore > existingScore) {
      byKey.set(key, result);
    }
  }

  const unique = [...byKey.values()];
  const kept: BarcodeResult[] = [];

  for (const result of unique) {
    const duplicateBox = kept.some((other) => {
      if (other.format !== result.format || other.text !== result.text) return false;
      if (!other.boundingBox || !result.boundingBox) return false;
      return boxesOverlap(other.boundingBox, result.boundingBox, 0.5);
    });
    if (!duplicateBox) kept.push(result);
  }

  return kept;
}
