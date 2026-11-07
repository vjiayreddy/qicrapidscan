"use client";

import { useState } from "react";
import type { BarcodeResult } from "@qicrapidscan/core";
import { BarcodeScanner, useBarcodeScanner } from "@qicrapidscan/react";

export function ScannerDemo() {
  const [mode, setMode] = useState<"component" | "hook">("component");
  const [log, setLog] = useState<BarcodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hook = useBarcodeScanner({
    formats: ["QR_CODE", "EAN_13", "CODE_128", "DATA_MATRIX"],
    detection: { multiple: true },
    autoStart: false,
    onResult: (results) => setLog((prev) => [...results, ...prev].slice(0, 20)),
    onError: (err) => setError(err.message),
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setMode("component")}>
          Component API
        </button>
        <button type="button" onClick={() => setMode("hook")}>
          Hook API
        </button>
      </div>

      {mode === "component" ? (
        <BarcodeScanner
          formats={["QR_CODE", "EAN_13", "CODE_128", "DATA_MATRIX"]}
          multiple
          autoStart
          onResult={(results) => setLog((prev) => [...results, ...prev].slice(0, 20))}
          onError={(err) => setError(err.message)}
          style={{ borderRadius: 8, overflow: "hidden" }}
          videoStyle={{ aspectRatio: "4 / 3", objectFit: "cover" }}
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <video
            ref={hook.videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              aspectRatio: "4 / 3",
              objectFit: "cover",
              background: "#111",
              borderRadius: 8,
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void hook.start()}>
              Start
            </button>
            <button type="button" onClick={() => void hook.stop()}>
              Stop
            </button>
            <button type="button" onClick={() => hook.pause()}>
              Pause
            </button>
            <button type="button" onClick={() => hook.resume()}>
              Resume
            </button>
          </div>
          <p style={{ margin: 0, color: "#666" }}>
            Scanning: {hook.isScanning ? "yes" : "no"}
          </p>
        </div>
      )}

      {error ? (
        <p style={{ color: "#b00020", margin: 0 }}>Error: {error}</p>
      ) : null}

      <section>
        <h2 style={{ fontSize: 18 }}>Results</h2>
        {log.length === 0 ? (
          <p style={{ color: "#777" }}>No barcodes yet.</p>
        ) : (
          <ol>
            {log.map((item, index) => (
              <li key={`${item.id}-${item.timestamp}-${index}`}>
                <strong>{item.format}</strong>: {item.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
