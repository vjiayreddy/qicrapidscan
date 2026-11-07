# Troubleshooting

## Camera never starts

1. Confirm HTTPS or `localhost`.
2. Check browser permission for the site.
3. Ensure a `<video>` element is mounted, muted, and has `playsInline` on iOS.
4. Listen for `error` events / `BarcodeError.code`:
   - `CAMERA_PERMISSION_DENIED`
   - `CAMERA_NOT_FOUND`
   - `CAMERA_IN_USE`
   - `CAMERA_CONSTRAINT_NOT_SUPPORTED`
   - `CAMERA_START_FAILED`
   - `UNSUPPORTED_BROWSER`

## Black video / freeze after navigation

Call `stop()` or `destroy()` on route change / unmount. In React, prefer `useBarcodeScanner` or `<BarcodeScanner />` so cleanup runs automatically.

## No barcodes found (not an error)

Empty detections are normal. Tune:

- `formats` (narrower is faster)
- `scanIntervalMs` / processing size options if configured
- Lighting, focus, and distance
- For multi: `detection.multiple`, `maxRegions`, `maxDepth`, `maxTimeMs`

## Multi-barcode misses dense packs

Dense grids need higher region budgets than live defaults. See [multi-barcode.md](./multi-barcode.md) and `pnpm benchmark:multi`. Do not claim 100% recall — Phase 3 corpus showed imperfect recall on dense cases.

## Next.js / SSR crash on import

If you see `window is not defined` at import time, ensure you are on a current `@qicrapidscan/*` build and that app code does not call `start` during SSR. Dynamic-import the scanner UI with `ssr: false` only if your own wrapper touches browser APIs at module scope.

## CDN `QicRapidScan` is undefined

- Load the IIFE script before your code.
- Global name is **`window.QicRapidScan`** (not `BarcodeSDK`).
- Prefer the min build: `dist/qicrapidscan.min.js`.

## React peer dependency warnings

Install `react` and `react-dom` ≥ 18 in the host app. `@qicrapidscan/react` does not bundle React.

## Bundle too large

CDN IIFE/ESM bundles include ZXing. Prefer the npm ESM/CJS entry (`@qicrapidscan/core`) so bundlers can tree-shake and dedupe. Measure with `pnpm benchmark:perf`.
