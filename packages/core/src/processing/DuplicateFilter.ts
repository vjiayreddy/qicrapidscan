import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";

export type DuplicateFilterMode = "cooldown" | "once";

function valueKey(format: BarcodeFormat, text: string): string {
  return `${format}:${text}`;
}

export class DuplicateFilter {
  private readonly lastSeen = new Map<string, number>();
  private enabled: boolean;
  private cooldownMs: number;
  private mode: DuplicateFilterMode;

  constructor(
    enabled = true,
    cooldownMs = 1500,
    mode: DuplicateFilterMode = "cooldown",
  ) {
    this.enabled = enabled;
    this.cooldownMs = cooldownMs;
    this.mode = mode;
  }

  configure(
    enabled?: boolean,
    cooldownMs?: number,
    mode?: DuplicateFilterMode,
  ): void {
    if (enabled !== undefined) this.enabled = enabled;
    if (cooldownMs !== undefined) this.cooldownMs = Math.max(0, cooldownMs);
    if (mode !== undefined) this.mode = mode;
  }

  /** Returns only results that pass the cooldown / once-per-session gate. */
  filter(results: BarcodeResult[], now = Date.now()): BarcodeResult[] {
    if (!this.enabled) return results;

    const accepted: BarcodeResult[] = [];
    for (const result of results) {
      const key = valueKey(result.format, result.text);
      const previous = this.lastSeen.get(key);
      if (previous !== undefined) {
        if (this.mode === "once") continue;
        if (now - previous < this.cooldownMs) continue;
      }
      this.lastSeen.set(key, now);
      accepted.push(result);
    }
    return accepted;
  }

  /** Seed values already accepted this session (survives scanner remounts). */
  seed(keys: Iterable<string>, now = Date.now()): void {
    for (const key of keys) {
      this.lastSeen.set(key, now);
    }
  }

  has(format: BarcodeFormat, text: string): boolean {
    return this.lastSeen.has(valueKey(format, text));
  }

  clear(): void {
    this.lastSeen.clear();
  }
}
