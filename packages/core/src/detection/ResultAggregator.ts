import type { BarcodeResult } from "../types/barcode.types.js";
import { dedupeResults } from "./Deduplicator.js";

export class ResultAggregator {
  private readonly items: BarcodeResult[] = [];

  add(results: BarcodeResult | BarcodeResult[]): void {
    if (Array.isArray(results)) {
      this.items.push(...results);
    } else {
      this.items.push(results);
    }
  }

  rawCount(): number {
    return this.items.length;
  }

  finalize(maxResults: number): BarcodeResult[] {
    return dedupeResults(this.items).slice(0, Math.max(0, maxResults));
  }
}
