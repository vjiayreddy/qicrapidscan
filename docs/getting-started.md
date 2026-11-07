# Getting started

## Install (npm)

```bash
pnpm add @qicrapidscan/core
# React apps:
pnpm add @qicrapidscan/react
```

Packages are currently **private / unpublished**. Until a public release, consume via the monorepo workspace or packed tarballs (`pnpm pack:smoke`).

## Vanilla

```ts
import { BarcodeScanner } from "@qicrapidscan/core";

const video = document.querySelector("video")!;
const scanner = new BarcodeScanner({ formats: ["QR_CODE", "EAN_13"] });

scanner.on("result", (results) => console.log(results));
scanner.on("error", (err) => console.error(err.code, err.message));

await scanner.start(video);
// later:
await scanner.destroy();
```

## React

```tsx
import { BarcodeScanner } from "@qicrapidscan/react";

export function ScanPage() {
  return (
    <BarcodeScanner
      formats={["QR_CODE"]}
      onResult={(results) => console.log(results)}
      onError={(error) => console.error(error)}
    />
  );
}
```

Or headless:

```tsx
const { videoRef, start, stop, results } = useBarcodeScanner({ formats: ["QR_CODE"] });
```

## Next.js App Router

- Import `@qicrapidscan/react` only from Client Components (`"use client"`).
- Do not call camera APIs during SSR.
- Production build check: `pnpm playground:build`.

## Vue / Angular / Svelte

Use `@qicrapidscan/core` inside the framework lifecycle. See `examples/` for Vue and Angular notes; no dedicated wrapper packages in v1.

## CDN

See [cdn.md](./cdn.md).

## Requirements

- Node 20+ for development
- Secure context + camera permission for live scan
- See [compatibility.md](./compatibility.md)
