# Security, privacy, and licensing

## Privacy model

- All camera frames and uploaded images are processed **locally in the browser** (or in Node when using image APIs in tests).
- QicRapidScan does **not** send frames, images, or scan results to a QicRapidScan backend.
- There is **no** analytics or telemetry in the SDK.
- Scanned values are not persisted by the SDK; the host app decides storage.

## Camera permissions

- Live scanning requires `navigator.mediaDevices.getUserMedia`.
- Browsers require a **secure context** (HTTPS or `localhost`).
- Permission denial surfaces as `BarcodeError` with code `CAMERA_PERMISSION_DENIED`.

## Security review (Phase 6)

| Area | Finding |
|---|---|
| Remote exfiltration | None in SDK code paths reviewed |
| Eval / dynamic script injection | None |
| Secrets in repo | No API keys or credentials required |
| Dependency surface | Primary runtime decode dep is `barcode-detector` (zxing-wasm) |
| XSS via results | Results are plain strings/bytes; apps must escape when rendering into HTML |
| Reverse engineering | Minified CDN builds are not a security boundary |

## Licensing

| Component | License | Action |
|---|---|---|
| QicRapidScan packages | Proprietary / unpublished (see root `LICENSE`) | Publish license TBD before public release |
| `barcode-detector` | MIT | Attribution in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) |
| `zxing-wasm` | Apache-2.0 | Attribution in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md); WASM fetched at runtime |

Commercial licensing and package ownership remain an open product-owner decision ([open-decisions.md](./open-decisions.md)).
