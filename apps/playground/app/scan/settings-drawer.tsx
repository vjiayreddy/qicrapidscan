"use client";

import type { BarcodeFormat } from "@qicrapidscan/core";
import { ONE_D_FORMATS, TWO_D_FORMATS } from "@qicrapidscan/core";
import type { ReactNode } from "react";

export type BarcodeTab = "1d" | "2d";

const FORMAT_LABELS: Record<BarcodeFormat, string> = {
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  ITF: "ITF / Code 25",
  QR_CODE: "QR Code",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

type SettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  multiple: boolean;
  onMultipleChange: (value: boolean) => void;
  showGuide: boolean;
  onShowGuideChange: (value: boolean) => void;
  editRoi: boolean;
  onEditRoiChange: (value: boolean) => void;
  beepTone: boolean;
  onBeepToneChange: (value: boolean) => void;
  showOverlay: boolean;
  onShowOverlayChange: (value: boolean) => void;
  barcodeTab: BarcodeTab;
  onBarcodeTabChange: (tab: BarcodeTab) => void;
  enabledFormats: Set<BarcodeFormat>;
  onToggleFormat: (format: BarcodeFormat) => void;
  onEnableAll: (formats: readonly BarcodeFormat[], enabled: boolean) => void;
  showAllFormats: boolean;
  onShowAllFormatsChange: (value: boolean) => void;
};

export function SettingsDrawer(props: SettingsDrawerProps) {
  const {
    open,
    onClose,
    multiple,
    onMultipleChange,
    showGuide,
    onShowGuideChange,
    editRoi,
    onEditRoiChange,
    beepTone,
    onBeepToneChange,
    showOverlay,
    onShowOverlayChange,
    barcodeTab,
    onBarcodeTabChange,
    enabledFormats,
    onToggleFormat,
    onEnableAll,
    showAllFormats,
    onShowAllFormatsChange,
  } = props;

  if (!open) return null;

  const tabFormats = barcodeTab === "1d" ? ONE_D_FORMATS : TWO_D_FORMATS;
  const visibleFormats = showAllFormats ? tabFormats : tabFormats.slice(0, 4);
  const allEnabled = tabFormats.every((f) => enabledFormats.has(f));
  const someEnabled = tabFormats.some((f) => enabledFormats.has(f));

  return (
    <div className="pg-settings-drawer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pg-settings-drawer__backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="pg-settings-drawer__panel">
        <header className="pg-settings-drawer__header">
          <button
            type="button"
            className="pg-settings-drawer__back"
            aria-label="Close settings"
            onClick={onClose}
          >
            <ChevronLeftIcon />
          </button>
          <h2 className="pg-settings-drawer__title">Settings</h2>
          <span className="pg-settings-drawer__header-spacer" />
        </header>

        <div className="pg-settings-drawer__body">
          <p className="pg-settings-drawer__section-label">Scan settings</p>
          <div className="pg-settings-card">
            <ToggleRow
              icon={<MultiIcon />}
              label="Multiple Scanning"
              checked={multiple}
              onChange={onMultipleChange}
            />
            <ToggleRow
              icon={<FinderIcon />}
              label="View Finder"
              checked={showGuide}
              onChange={(value) => {
                onShowGuideChange(value);
                if (!value) onEditRoiChange(false);
              }}
            />
            <ToggleRow
              icon={<RoiIcon />}
              label="Edit ROI"
              checked={editRoi}
              onChange={(value) => {
                if (value) onShowGuideChange(true);
                onEditRoiChange(value);
              }}
            />
            <ToggleRow
              icon={<BeepIcon />}
              label="Beep Tone"
              checked={beepTone}
              onChange={onBeepToneChange}
            />
            <ToggleRow
              icon={<ArIcon />}
              label="AR Overlay"
              checked={showOverlay}
              onChange={onShowOverlayChange}
              last
            />
          </div>

          <p className="pg-settings-drawer__section-label">Barcode settings</p>
          <div className="pg-settings-segment" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={barcodeTab === "1d"}
              className={`pg-settings-segment__btn${barcodeTab === "1d" ? " pg-settings-segment__btn--active" : ""}`}
              onClick={() => {
                onBarcodeTabChange("1d");
                onShowAllFormatsChange(false);
              }}
            >
              1D Barcodes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={barcodeTab === "2d"}
              className={`pg-settings-segment__btn${barcodeTab === "2d" ? " pg-settings-segment__btn--active" : ""}`}
              onClick={() => {
                onBarcodeTabChange("2d");
                onShowAllFormatsChange(false);
              }}
            >
              2D Barcodes
            </button>
          </div>

          <div
            className={`pg-settings-card${showAllFormats ? "" : " pg-settings-card--fade"}`}
          >
            <label className="pg-settings-row pg-settings-row--check">
              <span className="pg-settings-row__label">Enable all</span>
              <input
                type="checkbox"
                className="pg-settings-check"
                checked={allEnabled}
                ref={(el) => {
                  if (el) el.indeterminate = !allEnabled && someEnabled;
                }}
                onChange={(e) => onEnableAll(tabFormats, e.target.checked)}
              />
            </label>
            {visibleFormats.map((format, index) => (
              <ToggleRow
                key={format}
                label={FORMAT_LABELS[format]}
                checked={enabledFormats.has(format)}
                onChange={() => onToggleFormat(format)}
                last={
                  showAllFormats ? index === visibleFormats.length - 1 : false
                }
              />
            ))}
            {!showAllFormats && tabFormats.length > 4 ? (
              <button
                type="button"
                className="pg-settings-show-full"
                onClick={() => onShowAllFormatsChange(true)}
              >
                Show full
              </button>
            ) : null}
            {showAllFormats && tabFormats.length > 4 ? (
              <button
                type="button"
                className="pg-settings-show-full"
                onClick={() => onShowAllFormatsChange(false)}
              >
                Show less
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
  last = false,
}: {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`pg-settings-row${last ? " pg-settings-row--last" : ""}`}
    >
      <span className="pg-settings-row__left">
        {icon ? (
          <span className="pg-settings-row__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="pg-settings-row__label">{label}</span>
      </span>
      <span
        className={`pg-settings-switch${checked ? " pg-settings-switch--on" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="pg-settings-switch__input"
        />
        <span className="pg-settings-switch__track" aria-hidden>
          <span className="pg-settings-switch__knob" />
        </span>
      </span>
    </label>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MultiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="6"
        width="11"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="9"
        y="4"
        width="11"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M14.5 8.5v4M12.5 10.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FinderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 9V6a1 1 0 0 1 1-1h3M19 9V6a1 1 0 0 0-1-1h-3M5 15v3a1 1 0 0 0 1 1h3M19 15v3a1 1 0 0 1-1 1h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RoiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="6"
        width="14"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="3 2.5"
      />
      <path
        d="M8 10h3v3M16 14h-3v-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BeepIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 6 7 10H4v4h3l4 4V6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M15 9.5a3 3 0 0 1 0 5M17.5 7.5a6 6 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 8V5h3M19 8V5h-3M5 16v3h3M19 16v3h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 14.5 12 8l4 6.5H8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
