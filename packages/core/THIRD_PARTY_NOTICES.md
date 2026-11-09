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

- **Package:** `zxing-wasm` `^3.1.6` (direct + via `barcode-detector`)
- **Project:** [Sec-ant/zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- **License:** Apache-2.0

WebAssembly port of ZXing-C++. Used directly by the OpenCV ROI recovery cascade
(`readBarcodesFromImageData` with `binarizer` options) and transitively via the
`barcode-detector` ponyfill for general live/still decode. The reader WASM
binary is loaded at runtime (CDN or local asset via `prepareZXingModule`).

The full Apache-2.0 text ships with the dependency (`node_modules/zxing-wasm/LICENSE`)
and is also available at <https://www.apache.org/licenses/LICENSE-2.0>.

## @techstark/opencv-js

- **Package:** `@techstark/opencv-js` `5.0.0-release.1`
- **Project:** [TechStark/opencv-js](https://github.com/TechStark/opencv-js)
- **Upstream:** OpenCV.js (Apache-2.0)
- **License:** Apache-2.0

Lazy-loaded only for still-image YOLO ROI recovery (CLAHE, unsharp, adaptive
threshold, morphology). Not required for live camera scanning. The npm ESM/CJS
entries keep this package external; CDN builds also leave it external so the
cascade soft-skips when OpenCV is not available at runtime.

The full Apache-2.0 text ships with the dependency
(`node_modules/@techstark/opencv-js/LICENSE`) and is also available at
<https://www.apache.org/licenses/LICENSE-2.0>.

## CDN builds

The browser IIFE / ESM CDN builds (`dist/qicrapidscan*.js`) **bundle**
`barcode-detector` (and its JS glue). The WASM binary is still fetched at runtime.
Distributing those files therefore includes MIT- and Apache-2.0–licensed code.
Keep this notices file alongside published artifacts.

## npm package

The npm `@qicrapidscan/core` package declares `barcode-detector`, `zxing-wasm`,
and `@techstark/opencv-js` as runtime dependencies (not bundled in the library
ESM/CJS entry). Consumers install them via the dependency tree; this notice
still applies. OpenCV is only loaded for opt-in hybrid localization ROI recovery.
