import type { BarcodeResult } from "../types/barcode.types.js";

export class DuplicateFilter {
  private readonly lastSeen = new Map<string, number>();
  private enabled: boolean;
  private cooldownMs: number;

  constructor(enabled = true, cooldownMs = 1500) {
    this.enabled = enabled;
    this.cooldownMs = cooldownMs;
  }

  configure(enabled?: boolean, cooldownMs?: number): void {
    if (enabled !== undefined) this.enabled = enabled;
    if (cooldownMs !== undefined) this.cooldownMs = Math.max(0, cooldownMs);
  }

  /** Returns only results that pass the cooldown window. */
  filter(results: BarcodeResult[], now = Date.now()): BarcodeResult[] {
    if (!this.enabled) return results;

    const accepted: BarcodeResult[] = [];
    for (const result of results) {
      const key = result.id || `${result.format}:${result.text}`;
      const previous = this.lastSeen.get(key);
      if (previous !== undefined && now - previous < this.cooldownMs) {
        continue;
      }
      this.lastSeen.set(key, now);
      accepted.push(result);
    }
    return accepted;
  }

  clear(): void {
    this.lastSeen.clear();
  }
}
