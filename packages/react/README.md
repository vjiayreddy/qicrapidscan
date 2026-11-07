# `@qicrapidscan/react`

React bindings for QicRapidScan.

Docs: [getting started](../../docs/getting-started.md) · [API](../../docs/api.md) · [third-party notices](./THIRD_PARTY_NOTICES.md)

## Component

```tsx
import { BarcodeScanner } from "@qicrapidscan/react";

export function Page() {
  return (
    <BarcodeScanner
      formats={["QR_CODE", "EAN_13"]}
      multiple
      onResult={(results) => console.log(results)}
      onError={(error) => console.error(error)}
    />
  );
}
```

## Hook

```tsx
const { videoRef, start, stop, results, error, isScanning } = useBarcodeScanner({
  formats: ["QR_CODE"],
  detection: { multiple: true },
});

return <video ref={videoRef} muted playsInline />;
```

Lifecycle is Strict Mode–safe: the core scanner is destroyed on unmount.
