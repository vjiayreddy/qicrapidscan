# Third-party notices

This package embeds or depends on the following open-source software.

## barcode-detector

- **Package:** `barcode-detector` `^3.2.3`
- **Project:** [Sec-ant/barcode-detector](https://github.com/Sec-ant/barcode-detector)
- **License:** MIT

A Barcode Detection API ponyfill / polyfill built on ZXing-WASM. Used via
`barcode-detector/ponyfill` as the default decode engine for live and still-image
scanning, including native multi-symbol `detect()`.

The full MIT text ships with the dependency (`node_modules/barcode-detector/LICENSE`)
and is also available at <https://opensource.org/licenses/MIT>.

## zxing-wasm

- **Package:** `zxing-wasm` (transitive via `barcode-detector`)
- **Project:** [Sec-ant/zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- **License:** Apache-2.0

WebAssembly port of ZXing-C++. The reader WASM binary is loaded at runtime
(typically from a CDN or local asset via `prepareZXingModule`).

The full Apache-2.0 text ships with the dependency (`node_modules/zxing-wasm/LICENSE`)
and is also available at <https://www.apache.org/licenses/LICENSE-2.0>.

## CDN builds

The browser IIFE / ESM CDN builds (`dist/qicrapidscan*.js`) **bundle**
`barcode-detector` (and its JS glue). The WASM binary is still fetched at runtime.
Distributing those files therefore includes MIT- and Apache-2.0–licensed code.
Keep this notices file alongside published artifacts.

## npm package

The npm `@qicrapidscan/core` package declares `barcode-detector` as a runtime
dependency (not bundled in the library ESM/CJS entry). Consumers install
`barcode-detector` / `zxing-wasm` via the dependency tree; this notice still applies.
