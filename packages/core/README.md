# `@qicrapidscan/core`

Framework-independent QicRapidScan barcode scanning core.

See also: [getting started](../../docs/getting-started.md), [API](../../docs/api.md), [troubleshooting](../../docs/troubleshooting.md), [third-party notices](./THIRD_PARTY_NOTICES.md).

## Features

- Camera live scanning via `start(video)` / `stop` / `pause` / `resume`
- Image scanning via `scanImage(Blob | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement)`
- ZXing (`@zxing/library`) behind an internal adapter
- Typed errors + `result` / `error` events
- Multi-barcode: set `detection.multiple: true` (bounded region/tile strategy)
- CDN IIFE/ESM builds → `window.QicRapidScan`

```ts
const scanner = new BarcodeScanner({
  formats: ["QR_CODE"],
  detection: {
    multiple: true,
    maxResults: 10,
    maxRegions: 16,
    maxDepth: 2,
    overlap: 0.2,
    maxTimeMs: 250,
  },
});
```

Generate fixtures + metrics:

```bash
pnpm corpus:multi
pnpm benchmark:multi
```

## CDN

IIFE (script tag):

```html
<script src="https://cdn.jsdelivr.net/npm/@qicrapidscan/core@0.0.0/dist/qicrapidscan.min.js"></script>
<script>
  const scanner = new QicRapidScan.BarcodeScanner({
    detection: { multiple: true },
  });
</script>
```

Browser ESM:

```html
<script type="module">
  import { BarcodeScanner } from "https://cdn.jsdelivr.net/npm/@qicrapidscan/core@0.0.0/dist/qicrapidscan.esm.js";
</script>
```

Pin versions in production. Local artifacts: `dist/qicrapidscan.min.js`, `dist/qicrapidscan.esm.js`.

## Quick usage

```ts
import { BarcodeScanner } from "@qicrapidscan/core";

const scanner = new BarcodeScanner({
  formats: ["QR_CODE", "EAN_13", "CODE_128"],
});

scanner.on("result", (results) => {
  console.log(results);
});

await scanner.start(videoElement);
// ...
await scanner.destroy();
```

Requires HTTPS (or localhost) and camera permission for live scanning.
