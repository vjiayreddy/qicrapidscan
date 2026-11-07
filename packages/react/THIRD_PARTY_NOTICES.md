# Third-party notices

QicRapidScan redistributes or links the following third-party software.

## @zxing/library

- **Package:** `@zxing/library` `0.21.3`
- **Project:** [zxing-js/library](https://github.com/zxing-js/library)
- **License:** Apache License 2.0

```
Copyright 2007 ZXing authors / zxing-js contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

The full Apache-2.0 text ships with the dependency (`node_modules/@zxing/library/LICENSE`) and is also available at <https://www.apache.org/licenses/LICENSE-2.0>.

### CDN note

The browser IIFE / ESM CDN builds (`dist/qicrapidscan*.js`) **bundle** `@zxing/library`. Distributing those files therefore includes Apache-2.0–licensed code. Keep this notices file alongside published artifacts.

### npm note

The npm `@qicrapidscan/core` package declares `@zxing/library` as a runtime dependency (not bundled in the library ESM/CJS entry). Consumers install ZXing separately via the dependency tree; this notice still applies.
