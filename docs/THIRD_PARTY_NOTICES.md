# Third-party notices

This package embeds or depends on the following open-source software.

## barcode-detector

- **Package:** `barcode-detector` `^3.2.3`
- **Project:** [Sec-ant/barcode-detector](https://github.com/Sec-ant/barcode-detector)
- **License:** MIT

A Barcode Detection API ponyfill / polyfill built on ZXing-WASM. Used via
`barcode-detector/ponyfill` as the default decode engine.

## zxing-wasm

- **Package:** `zxing-wasm` (transitive via `barcode-detector`)
- **Project:** [Sec-ant/zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- **License:** Apache-2.0

WebAssembly port of ZXing-C++. The reader WASM binary is loaded at runtime.

See also `packages/core/THIRD_PARTY_NOTICES.md` for distribution notes (CDN bundling vs npm externals).
