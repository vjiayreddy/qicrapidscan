import Link from "next/link";
import type { CSSProperties } from "react";

const pre: CSSProperties = {
  background: "#111",
  color: "#f5f5f5",
  padding: 16,
  borderRadius: 8,
  overflow: "auto",
  fontSize: 13,
};

export default function DocsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <p>
        <Link href="/">← Home</Link>
      </p>
      <h1>Quick start</h1>
      <h2>npm</h2>
      <pre style={pre}>{`pnpm add @qicrapidscan/core @qicrapidscan/react`}</pre>
      <h2>React (App Router)</h2>
      <pre style={pre}>{`"use client";
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
      <h2>Vanilla core</h2>
      <pre style={pre}>{`import { BarcodeScanner } from "@qicrapidscan/core";

const scanner = new BarcodeScanner({ detection: { multiple: true } });
scanner.on("result", console.log);
await scanner.start(videoEl);`}</pre>
      <p>
        Full PRD: <code>docs/PRD.md</code> in the monorepo root.
      </p>
    </main>
  );
}
