# Supported barcode formats

Formats exposed by `@qicrapidscan/core` (via the ZXing adapter):

| Format | Default set |
|---|---|
| `QR_CODE` | yes |
| `EAN_13` | yes |
| `CODE_128` | yes |
| `DATA_MATRIX` | yes |
| `EAN_8` | opt-in |
| `UPC_A` | opt-in |
| `UPC_E` | opt-in |
| `CODE_39` | opt-in |
| `CODE_93` | opt-in |
| `ITF` | opt-in |
| `PDF_417` | opt-in |
| `AZTEC` | opt-in |

```ts
import { DEFAULT_FORMATS, ALL_SUPPORTED_FORMATS } from "@qicrapidscan/core";
```

Unsupported format strings throw `UNSUPPORTED_FORMAT` at construction/validation time.
Narrower format lists generally improve latency.
