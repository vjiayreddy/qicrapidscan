# `@qicrapidscan/react`

React bindings for QicRapidScan.

Docs: [getting started](../../docs/getting-started.md) · [API](../../docs/api.md) · [third-party notices](./THIRD_PARTY_NOTICES.md)

## Styles

Import once for ROI guide chrome (corners, laser, dim mask):

```ts
import "@qicrapidscan/react/styles.css";
```

## Component

```tsx
import { BarcodeScanner } from "@qicrapidscan/react";
import "@qicrapidscan/react/styles.css";

export function Page() {
  return (
    <BarcodeScanner
      formats={["QR_CODE", "EAN_13"]}
      multiple
      showGuide
      showOverlay
      onResult={(results) => console.log(results)}
      onError={(error) => console.error(error)}
    />
  );
}
```

`showGuide` draws the ROI viewfinder; `showOverlay` draws detection polygons from
`points` / `boundingBox`. Both default to `false` to keep the surface chrome-free.

Standalone `ScanGuide` and `ScanOverlay` are also exported for custom layouts.

## Hook

```tsx
const { videoRef, start, stop, scanImage, results, error, isScanning } =
  useBarcodeScanner({
    formats: ["QR_CODE"],
    detection: { multiple: true },
  });

return <video ref={videoRef} muted playsInline />;
```

Live camera and `scanImage` share the same format options (full 1D + 2D by default
from `@qicrapidscan/core`). Lifecycle is Strict Mode–safe: the core scanner is
destroyed on unmount.
