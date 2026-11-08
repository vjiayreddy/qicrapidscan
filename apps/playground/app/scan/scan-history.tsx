"use client";

import type { BarcodeFormat, BarcodeResult } from "@qicrapidscan/core";

const FORMAT_LABELS: Partial<Record<BarcodeFormat, string>> = {
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  ITF: "ITF",
  CODABAR: "Codabar",
  QR_CODE: "QR Code",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

export type ScanHistoryItem = BarcodeResult & {
  scannedAt: number;
};

export function scanValueKey(
  result: Pick<BarcodeResult, "format" | "text">,
): string {
  return `${result.format}:${result.text}`;
}

function formatLabel(format: BarcodeFormat): string {
  return FORMAT_LABELS[format] ?? format;
}

function HistoryThumb({ item }: { item: ScanHistoryItem }) {
  return (
    <div
      className="pg-scan-history__thumb"
      aria-hidden={item.cropDataUrl ? undefined : true}
    >
      {item.cropDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.cropDataUrl} alt="" />
      ) : (
        <span className="pg-scan-history__thumb-fallback">
          {formatLabel(item.format).slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function HistoryMeta({ item }: { item: ScanHistoryItem }) {
  return (
    <div className="pg-scan-history__meta">
      <span className="pg-scan-history__format">{formatLabel(item.format)}</span>
      <span className="pg-scan-history__text">{item.text}</span>
    </div>
  );
}

/** Bottom toast showing only the most recently scanned barcode. */
export function LatestScanToast({ item }: { item: ScanHistoryItem }) {
  return (
    <div className="pg-scan-latest" role="status" aria-live="polite">
      <HistoryThumb item={item} />
      <HistoryMeta item={item} />
    </div>
  );
}

type ScanHistoryDrawerProps = {
  open: boolean;
  items: ScanHistoryItem[];
  onClose: () => void;
  onClear: () => void;
};

/** Side drawer with the full session scan history. */
export function ScanHistoryDrawer({
  open,
  items,
  onClose,
  onClear,
}: ScanHistoryDrawerProps) {
  if (!open) return null;

  return (
    <div className="pg-history-drawer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pg-history-drawer__backdrop"
        aria-label="Close history"
        onClick={onClose}
      />
      <div className="pg-history-drawer__panel">
        <header className="pg-history-drawer__header">
          <button
            type="button"
            className="pg-history-drawer__back"
            aria-label="Close history"
            onClick={onClose}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M15 5 8 12l7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="pg-history-drawer__title">History</h2>
          <button
            type="button"
            className="pg-history-drawer__clear"
            onClick={onClear}
            disabled={items.length === 0}
          >
            Clear
          </button>
        </header>

        <div className="pg-history-drawer__body">
          {items.length === 0 ? (
            <p className="pg-history-drawer__empty">
              No barcodes scanned yet. Point the camera at a code to start.
            </p>
          ) : (
            <ul className="pg-scan-history__list pg-scan-history__list--drawer">
              {items.map((item) => (
                <li
                  key={`${scanValueKey(item)}-${item.scannedAt}`}
                  className="pg-scan-history__item pg-scan-history__item--drawer"
                >
                  <HistoryThumb item={item} />
                  <HistoryMeta item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
