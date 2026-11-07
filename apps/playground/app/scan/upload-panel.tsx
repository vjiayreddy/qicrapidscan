"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import type { BarcodeFormat, BarcodeResult } from "@qicrapidscan/core";
import { ScanOverlay } from "@qicrapidscan/react";
import type { Ref } from "react";

const FORMAT_LABELS: Partial<Record<BarcodeFormat, string>> = {
  EAN_8: "EAN-8",
  EAN_13: "EAN-13",
  UPC_A: "UPC-A",
  UPC_E: "UPC-E",
  CODE_128: "Code 128",
  CODE_39: "Code 39",
  CODE_93: "Code 93",
  ITF: "ITF",
  QR_CODE: "QR Code",
  DATA_MATRIX: "Data Matrix",
  PDF_417: "PDF417",
  AZTEC: "Aztec",
};

type UploadPanelProps = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  previewUrl: string | null;
  results: BarcodeResult[];
  sourceSize: { width: number; height: number };
  frameRef: Ref<HTMLDivElement>;
  frameSize: { width: number; height: number };
  onFile: (file: File | null) => void;
  onClear: () => void;
};

export function UploadPanel(props: UploadPanelProps) {
  const {
    open,
    onClose,
    busy,
    error,
    previewUrl,
    results,
    sourceSize,
    frameRef,
    frameSize,
    onFile,
    onClear,
  } = props;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  if (!open) return null;

  return (
    <div className="pg-upload-panel" role="dialog" aria-modal="true">
      <header className="pg-upload-panel__header">
        <button
          type="button"
          className="pg-upload-panel__icon-btn"
          aria-label="Back to live scan"
          onClick={onClose}
        >
          <ChevronLeftIcon />
        </button>
        <div className="pg-upload-panel__titles">
          <h2 className="pg-upload-panel__title">Scan from image</h2>
          <p className="pg-upload-panel__subtitle">
            Decode barcodes from a photo — no camera needed
          </p>
        </div>
        {previewUrl ? (
          <button
            type="button"
            className="pg-upload-panel__text-btn"
            onClick={onClear}
          >
            Clear
          </button>
        ) : (
          <span className="pg-upload-panel__header-spacer" />
        )}
      </header>

      <div className="pg-upload-panel__body">
        <input
          ref={inputRef}
          className="pg-upload-panel__file"
          type="file"
          accept="image/*"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />

        {!previewUrl ? (
          <div
            className={`pg-upload-drop${dragging ? " pg-upload-drop--active" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
          >
            <span className="pg-upload-drop__icon" aria-hidden>
              <ImageIcon />
            </span>
            <h3 className="pg-upload-drop__title">Drop an image here</h3>
            <p className="pg-upload-drop__hint">
              PNG, JPG, or WebP with one or more barcodes
            </p>
            <button
              type="button"
              className="pg-btn pg-btn--primary pg-btn--lg"
              onClick={pickFile}
            >
              Choose image
            </button>
          </div>
        ) : (
          <div className="pg-upload-result">
            <div ref={frameRef} className="pg-upload-result__frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Uploaded barcode image"
                className="pg-upload-result__img"
              />
              <ScanOverlay
                results={results}
                sourceWidth={sourceSize.width}
                sourceHeight={sourceSize.height}
                containerWidth={frameSize.width}
                containerHeight={frameSize.height}
                objectFit="contain"
              />
              {busy ? (
                <div className="pg-upload-result__busy">Scanning…</div>
              ) : null}
            </div>

            <div className="pg-upload-result__meta">
              {busy ? (
                <p className="pg-muted">Reading barcodes…</p>
              ) : results.length > 0 ? (
                <>
                  <p className="pg-upload-result__count">
                    Found {results.length} barcode
                    {results.length === 1 ? "" : "s"}
                  </p>
                  <ul className="pg-upload-result__list">
                    {results.map((item, index) => (
                      <li
                        key={`${item.id}-${item.timestamp}-${index}`}
                        className="pg-upload-result__item"
                      >
                        <span className="pg-upload-result__format">
                          {FORMAT_LABELS[item.format] ?? item.format}
                        </span>
                        <span className="pg-upload-result__text">
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="pg-muted">
                  No barcodes detected in this image. Try another photo or a
                  sharper crop.
                </p>
              )}

              <div className="pg-btn-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="pg-btn pg-btn--primary"
                  onClick={pickFile}
                >
                  Choose another
                </button>
                <button
                  type="button"
                  className="pg-btn pg-btn--secondary"
                  onClick={onClose}
                >
                  Back to camera
                </button>
              </div>
            </div>
          </div>
        )}

        {error ? (
          <p className="pg-status pg-status--error" style={{ marginTop: 16 }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
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

function ImageIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M5 16l4-4 3 3 3-4 4 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
