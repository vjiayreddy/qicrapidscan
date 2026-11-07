import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="pg-shell">
      <p className="pg-caption" style={{ marginBottom: 16 }}>
        <Link href="/">← Home</Link>
      </p>
      <h1 className="pg-display">Quick start</h1>
      <p className="pg-body">
        Install the packages and drop a scanner into React or vanilla JS.
      </p>

      <h2 className="pg-title">npm</h2>
      <pre className="pg-pre">{`pnpm add @qicrapidscan/core @qicrapidscan/react`}</pre>

      <h2 className="pg-title">React (App Router)</h2>
      <pre className="pg-pre">{`"use client";
import { BarcodeScanner } from "@qicrapidscan/react";

export function Scan() {
  return (
    <BarcodeScanner
      formats={["QR_CODE", "EAN_13"]}
      multiple
      onResult={(results) => console.log(results)}
    />
  );
}`}</pre>

      <h2 className="pg-title">Vanilla core</h2>
      <pre className="pg-pre">{`import { BarcodeScanner } from "@qicrapidscan/core";

const scanner = new BarcodeScanner({ detection: { multiple: true } });
scanner.on("result", console.log);
await scanner.start(videoEl);`}</pre>

      <p className="pg-muted">
        Full PRD: <code className="pg-code">docs/PRD.md</code> in the monorepo
        root.
      </p>
    </main>
  );
}
