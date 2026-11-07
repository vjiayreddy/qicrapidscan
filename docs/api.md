# API overview

## `@qicrapidscan/core`

### `BarcodeScanner`

```ts
const scanner = new BarcodeScanner(options?);
```

| Method | Description |
|---|---|
| `start(video)` | Attach camera stream to `HTMLVideoElement` and begin scanning |
| `stop()` | Stop scanning and release the camera stream |
| `pause()` / `resume()` | Pause/resume decode loop without tearing down the stream |
| `scanImage(input)` | Decode from `Blob` \| `HTMLImageElement` \| `HTMLCanvasElement` \| `HTMLVideoElement` |
| `listCameras()` | Enumerate video input devices (permission-dependent) |
| `switchCamera(deviceId)` | Switch active device while scanning |
| `destroy()` | Full teardown; further use throws `SCANNER_DESTROYED` |
| `on(event, handler)` / `off(...)` | Subscribe to `result` or `error` |

### Options (high level)

- `formats?: BarcodeFormat[]` — see [formats.md](./formats.md)
- `camera?` — `facingMode`, `deviceId`, ideal width/height/frameRate
- `detection?` — multi-barcode bounds: `multiple`, `maxResults`, `maxRegions`, `maxDepth`, `overlap`, `maxTimeMs`

### `BarcodeResult`

```ts
{
  id: string;
  text: string;
  format: BarcodeFormat;
  rawBytes?: Uint8Array;
  boundingBox?: { x; y; width; height };
  points?: Array<{ x; y }>;
  timestamp: number;
}
```

Missing geometry is omitted — never fabricated.

### `BarcodeError`

Typed `Error` with `code: BarcodeErrorCode`. Empty scan results are **not** errors.

## `@qicrapidscan/react`

| Export | Role |
|---|---|
| `BarcodeScanner` | Video + lifecycle component |
| `useBarcodeScanner` | Headless hook (`videoRef`, `start`, `stop`, results/error state) |
| `useCamera` | Lower-level camera helper |

Peer dependencies: `react`, `react-dom` ≥ 18.
