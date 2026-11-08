# Supported barcode formats

Formats exposed by `@qicrapidscan/core` (via the ZXing adapter). For now only **1D** and **2D** barcode scanning is enabled (live camera and image upload share the same format list). OCR and other modes are not enabled.

| Format | Group | Default set |
|---|---|---|
| `EAN_8` | 1D | yes |
| `EAN_13` | 1D | yes |
| `UPC_A` | 1D | yes |
| `UPC_E` | 1D | yes |
| `CODE_128` | 1D | yes |
| `CODE_39` | 1D | yes |
| `CODE_93` | 1D | yes |
| `ITF` | 1D | yes |
| `CODABAR` | 1D | yes |
| `QR_CODE` | 2D | yes |
| `DATA_MATRIX` | 2D | yes |
| `PDF_417` | 2D | yes |
| `AZTEC` | 2D | yes |

```ts
import {
  DEFAULT_FORMATS,
  ALL_SUPPORTED_FORMATS,
  ONE_D_FORMATS,
  TWO_D_FORMATS,
} from "@qicrapidscan/core";
```

- `ONE_D_FORMATS` — linear symbologies only
- `TWO_D_FORMATS` — matrix symbologies only
- `DEFAULT_FORMATS` / `ALL_SUPPORTED_FORMATS` — full 1D + 2D set (used for both live camera and `scanImage`)

Unsupported format strings throw `UNSUPPORTED_FORMAT` at construction/validation time.
Narrower format lists generally improve latency when you do not need every symbology.

For **live camera**, prefer `detection.multiple: false` and a modest
`performance.scanInterval` / downscale (`maxWidth`/`maxHeight`). Multi-region
tiling is expensive on the main thread when many 1D formats are enabled —
use `multiple: true` mainly for image upload / offline scans.

Live sessions also **band formats** (≤4 per frame, rotating the rest) so
1D / 1D+2D cost stays close to 2D-only even with `TRY_HARDER` on by default.
Image upload still uses the full format list plus multi-scale / enhance /
rotation fallbacks (`performance.multiScale`, `imageEnhancement`,
`rotationRetry`).
