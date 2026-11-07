import type { BarcodeFormat } from "../types/barcode.types.js";

/**
 * Prefer these every live frame so common codes stay responsive.
 * Remaining formats rotate in one-at-a-time to cap per-frame ZXing cost.
 */
const LIVE_PRIORITY: readonly BarcodeFormat[] = [
  "QR_CODE",
  "EAN_13",
  "CODE_128",
  "DATA_MATRIX",
] as const;

export const LIVE_FORMAT_BAND_TARGET = 4;

/**
 * Build a ≤4-format subset for one live frame so 1D / 1D+2D decode cost
 * stays close to a 2D-only session (which is already ~4 formats).
 */
export function selectLiveFormatBand(
  formats: readonly BarcodeFormat[],
  cursor: number,
): { formats: BarcodeFormat[]; nextCursor: number } {
  if (formats.length <= LIVE_FORMAT_BAND_TARGET) {
    return { formats: [...formats], nextCursor: cursor };
  }

  const available = new Set(formats);
  const preferred = LIVE_PRIORITY.filter((format) => available.has(format)).slice(
    0,
    LIVE_FORMAT_BAND_TARGET - 1,
  );
  const preferredSet = new Set(preferred);
  const rest = formats.filter((format) => !preferredSet.has(format));

  if (rest.length === 0) {
    return { formats: preferred, nextCursor: cursor };
  }

  const extra = rest[cursor % rest.length]!;
  return {
    formats: [...preferred, extra],
    nextCursor: cursor + 1,
  };
}
