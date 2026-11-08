"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type DemoMode = "1d" | "2d" | "image" | "image-1d" | "image-2d";

type ModePickerProps = {
  onSelect: (mode: DemoMode) => void;
};

export function ModePicker({ onSelect }: ModePickerProps) {
  return (
    <div className="pg-mode-picker">
      <header className="pg-mode-picker__header">
        <Link href="/" className="pg-mode-picker__home" aria-label="Back to home">
          <HomeIcon />
        </Link>
        <div className="pg-mode-picker__titles">
          <h1 className="pg-mode-picker__title">QicRapidScan</h1>
          <p className="pg-mode-picker__subtitle">Choose what to scan</p>
        </div>
        <span className="pg-mode-picker__header-spacer" />
      </header>

      <div className="pg-mode-picker__body">
        <section className="pg-mode-picker__section" aria-labelledby="pg-mode-single">
          <h2 id="pg-mode-single" className="pg-mode-picker__section-label">
            Single barcode scanning
          </h2>
          <div className="pg-mode-picker__card">
            <ModeRow
              label="1D Barcodes"
              icon={<Barcode1dIcon />}
              onClick={() => onSelect("1d")}
            />
            <ModeRow
              label="2D Codes"
              icon={<Barcode2dIcon />}
              onClick={() => onSelect("2d")}
              last
            />
          </div>
        </section>

        <section className="pg-mode-picker__section" aria-labelledby="pg-mode-still">
          <h2 id="pg-mode-still" className="pg-mode-picker__section-label">
            Still image scanning
          </h2>
          <div className="pg-mode-picker__card">
            <ModeRow
              label="1D from Image"
              icon={<Barcode1dIcon />}
              onClick={() => onSelect("image-1d")}
            />
            <ModeRow
              label="2D from Image"
              icon={<Barcode2dIcon />}
              onClick={() => onSelect("image-2d")}
            />
            <ModeRow
              label="All formats from Image"
              icon={<ImageScanIcon />}
              onClick={() => onSelect("image")}
              last
            />
          </div>
          <p className="pg-mode-picker__disclaimer">
            Imported images are processed solely to detect barcodes and are not
            stored or shared. You can refine formats anytime in Settings.
          </p>
        </section>

        <footer className="pg-mode-picker__footer">
          <h3 className="pg-mode-picker__footer-title">
            Learn more about the SDK
          </h3>
          <p className="pg-mode-picker__footer-text">
            Client-side barcode scanning for the web — TypeScript core, React
            bindings, no servers.
          </p>
          <Link href="/docs" className="pg-btn pg-btn--primary">
            Docs
          </Link>
        </footer>
      </div>
    </div>
  );
}

function ModeRow({
  label,
  icon,
  onClick,
  last = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      className={`pg-mode-picker__row${last ? " pg-mode-picker__row--last" : ""}`}
      onClick={onClick}
    >
      <span className="pg-mode-picker__row-left">
        <span className="pg-mode-picker__row-icon" aria-hidden>
          {icon}
        </span>
        <span className="pg-mode-picker__row-label">{label}</span>
      </span>
      <ChevronRightIcon />
    </button>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Barcode1dIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6v12M7 6v12M9 6v12M12 6v12M14 6v12M17 6v12M20 6v12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Barcode2dIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M13 13h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3v-3Zm4 4h3v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path
        d="M5 16l4-4 3 3 3-4 4 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
