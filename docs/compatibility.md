# Browser and device compatibility

## Proposed support matrix (pending device lab sign-off)

APIs required for live camera scanning:

- Secure context (`https:` or `localhost`)
- `navigator.mediaDevices.getUserMedia`
- `HTMLVideoElement` + `HTMLCanvasElement` / `CanvasRenderingContext2D`
- `requestAnimationFrame` (frame loop)

Image-only scanning additionally needs canvas image decoding (`createImageBitmap` or `Image`/`Blob` paths used by the core).

| Browser | Min version (proposed) | Camera | Image scan | Notes |
|---|---|---|---|---|
| Chrome (desktop) | 90+ | Expected | Expected | Primary CI / playground target |
| Edge (Chromium) | 90+ | Expected | Expected | Same engine as Chrome |
| Firefox (desktop) | 90+ | Expected | Expected | Facing-mode / torch quirks possible |
| Safari (macOS) | 15+ | Expected | Expected | HTTPS required; permission UX differs |
| Chrome (Android) | 90+ | Expected | Expected | Prefer `facingMode: environment` |
| Safari (iOS) | 15+ | Expected | Expected | `playsInline` + muted video required; user gesture often needed |
| Samsung Internet | recent Chromium | Expected | Expected | Treat as Chromium-class |

**Status:** Matrix is **API-based**, not yet signed off from a full physical device lab. Record manual results in the table below as devices are tested.

### Manual device log

| Device / OS | Browser | Camera start/stop | Multi image | Date | Tester | Result |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | Not yet filled |

## Feature detection

- Missing `mediaDevices` / insecure context → `UNSUPPORTED_BROWSER` or camera start errors via `mapCameraError`.
- Torch / advanced constraints are capability-detected per track; absence is not fatal.
- Worker mode is **deferred** for the first public release ([open-decisions.md](./open-decisions.md)).

## SSR / Node

- Importing `@qicrapidscan/core` or `@qicrapidscan/react` must not touch `window` / `document` / `navigator` at module evaluation.
- Verified by `pnpm ssr:smoke`.
- Camera APIs are only used after explicit `start(...)` / hook effects.

## React

- Peer: `react` / `react-dom` ≥ 18
- Strict Mode double-mount must not leave duplicate MediaStreams (covered by React package tests)
