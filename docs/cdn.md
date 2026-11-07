# CDN usage

Artifacts (from `@qicrapidscan/core` build):

| File | Format |
|---|---|
| `dist/qicrapidscan.min.js` | Minified IIFE → `window.QicRapidScan` |
| `dist/qicrapidscan.js` | Readable IIFE |
| `dist/qicrapidscan.esm.js` | Browser ESM (ZXing bundled) |

`package.json` maps `unpkg` / `jsdelivr` to the min IIFE. Export subpath: `@qicrapidscan/core/cdn` → ESM CDN file.

## IIFE

```html
<script src="./qicrapidscan.min.js"></script>
<script>
  const { BarcodeScanner } = QicRapidScan;
  const scanner = new BarcodeScanner({ formats: ["QR_CODE"] });
</script>
```

## ESM

```html
<script type="module">
  import { BarcodeScanner } from "./qicrapidscan.esm.js";
</script>
```

Pin versions in production. CDN builds include ZXing — see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

Local smoke: `pnpm cdn:smoke`.
