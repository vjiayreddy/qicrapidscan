# Product Requirements Document (PRD)
# BarcodeSDK — Client-Side Web Barcode Scanning SDK

**Document status:** Ready for implementation planning  
**Version:** 1.0  
**Product:** BarcodeSDK  
**Primary distribution:** npm + CDN  
**Repository approach:** Next.js monorepo using PNPM workspaces and Turborepo  
**Core language:** TypeScript  
**Bundler:** Rollup  
**Initial decoding engine:** ZXing JavaScript libraries

---

## 1. Product overview

BarcodeSDK is a browser-based barcode scanning SDK designed for integration into JavaScript applications and frameworks. It provides camera scanning, image scanning, and multi-barcode result collection through a consistent framework-independent API.

The SDK will be distributed through:

1. **npm packages** for JavaScript and framework integrations.
2. **CDN bundles** for direct browser usage without a build step.

The core scanner must run locally in the browser. Barcode decoding must not require a BarcodeSDK backend or send camera frames/images to a remote service.

### 1.1 Product vision

Provide a reusable, production-oriented barcode scanning SDK that developers can integrate into React, Next.js, Vue, Angular, Svelte, and vanilla JavaScript applications without rewriting scanning logic for each framework.

### 1.2 Core product principles

- Framework-independent core.
- Client-side processing by default.
- Stable public API independent of the underlying decoder.
- Consistent result types across npm, CDN, and framework integrations.
- Explicit lifecycle management for camera and processing resources.
- Honest, tested support claims for barcode formats and multi-barcode detection.
- Small, configurable integration surface with optional advanced capabilities.

---

## 2. Goals and non-goals

### 2.1 Goals

- Deliver a TypeScript-first core scanning package.
- Support live camera scanning in supported browsers.
- Support scanning images supplied as `Blob`, `File`, `HTMLImageElement`, or `HTMLCanvasElement`.
- Support multiple barcode results from one image/frame through a tested multi-region strategy.
- Return barcode text, format, timestamp, result points, and bounding-box coordinates where available.
- Support configurable barcode formats and camera constraints.
- Provide a React package with a component and hook.
- Allow all other JavaScript frameworks to use the core API directly.
- Publish ESM and CommonJS npm builds.
- Publish browser ESM and standalone IIFE CDN builds.
- Provide documentation, examples, automated tests, and a repeatable release process.

### 2.2 Non-goals for initial release

- Cloud-based barcode recognition.
- Server-side barcode scanning.
- Native iOS or Android SDKs.
- Guaranteed recognition of every barcode in every image.
- ML-based object detection or barcode localization in the first release.
- Product lookup, inventory lookup, or database integration.
- A hosted account dashboard or subscription/licensing server unless added as a separate product requirement.
- A fully styled scanner UI that cannot be customized.

---

## 3. Target users and use cases

### 3.1 Target users

- Front-end developers building web applications.
- React and Next.js developers.
- Developers using Vue, Angular, Svelte, or vanilla JavaScript.
- Businesses integrating scanning into medical, retail, logistics, warehouse, and inventory workflows.

### 3.2 Primary use cases

1. Scan one or more barcodes using a device camera.
2. Upload an image and retrieve all decodable barcodes.
3. Capture a still image from the camera and scan it.
4. Switch between available cameras.
5. Display barcode result text and format.
6. Draw barcode result overlays using returned coordinates.
7. Integrate scanning into an existing application without adopting a particular UI framework.

---

## 4. Technical architecture

### 4.1 Architecture rule

The core package must not depend on React, Next.js, Vue, Angular, or any other UI framework.

All framework integrations must call the same core API. The core package owns camera lifecycle, frame scheduling, decoding, multi-region scanning, result normalization, and error handling.

```text
                         Applications
       React / Next.js / Vue / Angular / Svelte / Vanilla
                              |
                 +------------+------------+
                 |                         |
          @barcodesdk/react          Core JavaScript API
                 |                         |
                 +------------+------------+
                              |
                       @barcodesdk/core
                              |
       +----------------------+-----------------------+
       |              |             |                 |
   Camera         Frame          Detection          Events /
   Manager        Processor      Pipeline           Lifecycle
       |              |             |
       +--------------+-------------+
                              |
                    ZXing Decoder Adapter
                              |
                 @zxing/library / compatible
                  ZXing JavaScript dependency
```

### 4.2 Package boundaries

| Package | Responsibility |
|---|---|
| `@barcodesdk/core` | Framework-independent scanner and public types |
| `@barcodesdk/react` | React component, hook, and React-specific types |
| Internal test utilities | Fixtures, generated barcode images, test helpers |

Only the core and React packages are public packages for the first release.

### 4.3 Monorepo structure

```text
barcode-sdk/
├── apps/
│   ├── docs/                         # Next.js documentation
│   └── playground/                   # Next.js demo and QA app
│
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── scanner/
│   │   │   │   ├── BarcodeScanner.ts
│   │   │   │   ├── ScannerController.ts
│   │   │   │   └── ScannerLifecycle.ts
│   │   │   ├── camera/
│   │   │   │   ├── CameraManager.ts
│   │   │   │   ├── CameraConstraints.ts
│   │   │   │   └── CameraCapabilities.ts
│   │   │   ├── decoder/
│   │   │   │   ├── ZXingDecoder.ts
│   │   │   │   └── DecoderAdapter.ts
│   │   │   ├── detection/
│   │   │   │   ├── MultiBarcodeDetector.ts
│   │   │   │   ├── RegionScanner.ts
│   │   │   │   ├── ImageTiler.ts
│   │   │   │   ├── ResultAggregator.ts
│   │   │   │   └── Deduplicator.ts
│   │   │   ├── processing/
│   │   │   │   ├── FrameProcessor.ts
│   │   │   │   ├── ImagePreprocessor.ts
│   │   │   │   └── ImageScanner.ts
│   │   │   ├── events/
│   │   │   │   └── EventEmitter.ts
│   │   │   ├── errors/
│   │   │   ├── types/
│   │   │   │   ├── scanner.types.ts
│   │   │   │   ├── barcode.types.ts
│   │   │   │   └── camera.types.ts
│   │   │   └── index.ts
│   │   ├── rollup.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── react/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── BarcodeScanner.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useBarcodeScanner.ts
│   │   │   │   └── useCamera.ts
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   ├── rollup.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── testing/
│       ├── fixtures/
│       ├── generated-images/
│       └── helpers/
│
├── examples/
│   ├── vanilla/
│   ├── react/
│   ├── nextjs/
│   ├── vue/
│   └── angular/
│
├── scripts/
│   ├── build-all.ts
│   └── verify-packages.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish.yml
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
├── tsconfig.base.json
└── README.md
```

The folder layout may be adjusted during implementation, but package boundaries and framework independence are mandatory.

---

## 5. Barcode engine and multi-barcode strategy

### 5.1 ZXing integration

Use the ZXing JavaScript ecosystem as the initial decoding engine. Keep it behind an internal decoder adapter so the public API does not expose ZXing classes or result objects.

The implementation team must verify the exact capabilities of the selected JavaScript ZXing packages and versions before claiming support for any format or multi-code operation.

**Important technical constraint:** Do not assume that multi-barcode APIs available in the Java ZXing project are available in the JavaScript port. Standard single-result decoding is not equivalent to multi-barcode localization.

### 5.2 Multi-barcode detection

The first implementation will use a best-effort multi-region strategy around the ZXing decoder:

1. Attempt decoding on the full source image/frame.
2. Collect decoded results and available result points.
3. Create candidate regions that exclude or reduce already-decoded barcode areas.
4. Scan remaining regions using configurable overlapping tiles or recursive subdivision.
5. Map region-relative points and boxes to the original source coordinate system.
6. Aggregate and deduplicate results.
7. Stop when configured region, depth, time, or result limits are reached.

The algorithm must avoid unbounded recursion and repeated scanning of identical regions.

### 5.3 Detection limitations

- A decoder may return only one result for a given image region.
- Result points may be missing, incomplete, or insufficient to construct an accurate bounding box.
- Region-based rescanning may miss small, adjacent, overlapping, rotated, or low-quality barcodes.
- Multi-barcode accuracy must be measured against a labeled test dataset.
- Do not claim guaranteed detection of every barcode in a frame.
- Do not fabricate bounding boxes when the decoder does not provide enough information. Return `undefined` for unavailable geometry.

### 5.4 Multi-detection configuration

```ts
interface MultiDetectionOptions {
  multiple?: boolean;
  maxResults?: number;
  maxRegions?: number;
  maxDepth?: number;
  overlap?: number;
}
```

Recommended initial defaults should be conservative and configurable. Final values must be selected through benchmark testing rather than assumed in advance.

---

## 6. Public API requirements

### 6.1 Barcode format type

Expose a framework-independent `BarcodeFormat` type. It should represent only formats actually supported by the configured decoder.

The initial candidate format list includes:

- EAN-8
- EAN-13
- UPC-A
- UPC-E
- Code 128
- Code 39
- Code 93
- ITF
- QR Code
- Data Matrix
- PDF417
- Aztec

Each format must be validated with real test fixtures before being documented as supported. Unsupported formats must fail clearly or be rejected during configuration validation.

### 6.2 Scanner options

```ts
export interface BarcodeScannerOptions {
  formats?: BarcodeFormat[];

  camera?: {
    deviceId?: string;
    facingMode?: "user" | "environment";
    width?: number;
    height?: number;
    frameRate?: number;
  };

  detection?: {
    multiple?: boolean;
    maxResults?: number;
    maxRegions?: number;
    maxDepth?: number;
    overlap?: number;
  };

  performance?: {
    scanInterval?: number;
    maxWidth?: number;
    maxHeight?: number;
    useWorker?: boolean;
  };

  duplicateFilter?: {
    enabled?: boolean;
    cooldown?: number;
  };
}
```

Validate numeric values, formats, and camera constraints. Document defaults and units.

### 6.3 Standard result model

```ts
export interface BarcodeResult {
  id: string;
  text: string;
  format: BarcodeFormat;
  rawBytes?: Uint8Array;

  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  points?: Array<{
    x: number;
    y: number;
  }>;

  timestamp: number;
}
```

Requirements:

- `text` contains the decoded value.
- `format` identifies the decoded barcode format.
- `timestamp` identifies when the result was captured or decoded.
- `points` contains decoder-provided points mapped to the original source.
- `boundingBox` is optional and must not be invented.
- Coordinates must use the original image/video frame coordinate system.
- `id` must be stable enough for result rendering during the relevant scanning session; it need not be globally persistent.

### 6.4 Core scanner API

```ts
export class BarcodeScanner {
  constructor(options?: BarcodeScannerOptions);

  start(video: HTMLVideoElement): Promise<void>;
  stop(): Promise<void>;

  pause(): void;
  resume(): void;

  scanImage(
    source:
      | HTMLImageElement
      | HTMLCanvasElement
      | HTMLVideoElement
      | Blob
  ): Promise<BarcodeResult[]>;

  getCameras(): Promise<CameraDevice[]>;
  switchCamera(deviceId: string): Promise<void>;

  on(
    event: "result",
    callback: (results: BarcodeResult[]) => void
  ): () => void;

  on(
    event: "error",
    callback: (error: BarcodeError) => void
  ): () => void;

  destroy(): Promise<void>;
}
```

The implementation may add events such as `scan`, `started`, `stopped`, or `cameraChanged`, but must document event semantics. Event subscriptions should return unsubscribe functions.

### 6.5 Result event behavior

- Emit an array of results, including when only one result is found.
- Do not emit a result event for an empty result set unless explicitly documented.
- Distinguish a completed scan with no result from a decoder/runtime error.
- Duplicate filtering must be configurable.
- Document whether each event represents a frame, a newly observed barcode, or the current set of visible barcodes.
- Avoid surprising repeated callbacks for the same barcode when duplicate filtering is enabled.

---

## 7. Camera and image scanning requirements

### 7.1 Camera

- Request camera access only after an explicit user action or documented initialization call.
- Support `facingMode` and explicit camera `deviceId`.
- Expose available camera devices where browser permissions allow.
- Support switching cameras.
- Handle permission denied, no camera, camera in use, unsupported constraints, and device removal.
- Stop every media track when stopped or destroyed.
- Detach event listeners and cancel scheduled frame work.
- Do not leave a camera active after a React component unmounts.

Camera access generally requires HTTPS or localhost and user permission. The SDK documentation must explain this.

### 7.2 Image scanning

Support:

- `Blob`
- `File` through its `Blob` compatibility
- `HTMLImageElement`
- `HTMLCanvasElement`
- `HTMLVideoElement` where applicable

The SDK must manage object URL cleanup if it creates object URLs internally.

### 7.3 Frame processing

- Never start a new decode operation while the previous operation is still running for the same scanner instance.
- Use `requestVideoFrameCallback` where available, with a documented fallback.
- Make scan interval and maximum processing dimensions configurable.
- Avoid unnecessary full-resolution copies.
- Provide a cancellation/stop path for pending work where feasible.
- Avoid unbounded queues of frames.

---

## 8. React package requirements

Package: `@barcodesdk/react`

### 8.1 React component

Proposed usage:

```tsx
import { BarcodeScanner } from "@barcodesdk/react";

export function ScannerPage() {
  return (
    <BarcodeScanner
      formats={["EAN_13", "CODE_128"]}
      multiple
      onResult={(results) => {
        console.log(results);
      }}
      onError={(error) => {
        console.error(error);
      }}
    />
  );
}
```

The component should provide a minimal, customizable scanner surface. Styling should not be forced on consumers.

### 8.2 React hook

Proposed usage:

```tsx
const {
  start,
  stop,
  pause,
  resume,
  results,
  isScanning,
  error
} = useBarcodeScanner({
  formats: ["EAN_13", "CODE_128"],
  detection: {
    multiple: true
  }
});
```

### 8.3 React lifecycle requirements

- Create the core instance without accessing browser globals during module evaluation.
- Initialize browser-only resources in effects or explicit user actions.
- Clean up on unmount.
- Handle React Strict Mode setup/cleanup behavior.
- Avoid creating a new scanner instance on every render.
- Keep React and ReactDOM as peer dependencies and externalize them from the React bundle.
- Support React 18 and later, subject to compatibility testing.

---

## 9. Framework compatibility

The core package must be usable without React.

| Framework | Integration |
|---|---|
| Vanilla JavaScript | Direct core API |
| React | `@barcodesdk/react` or core API |
| Next.js | Client Component using core or React package |
| Vue | Core API inside component lifecycle |
| Angular | Core API inside component/service lifecycle |
| Svelte | Core API inside component lifecycle |

The first release does not require separate Vue, Angular, or Svelte wrapper packages.

### 9.1 Next.js SSR requirements

- Importing the package on the server must not access `window`, `document`, `navigator`, `MediaStream`, or other browser-only globals at module scope.
- Camera initialization must occur in a client-side context.
- Documentation must include a Next.js App Router example using a Client Component.
- Verify the package with a production Next.js build, not only the development server.

---

## 10. Build and distribution requirements

### 10.1 Tooling

- PNPM workspaces.
- Turborepo for task orchestration.
- TypeScript.
- Rollup for package bundles.
- Vitest for unit tests.
- Playwright for browser integration tests.
- GitHub Actions for CI and release automation.

### 10.2 Core npm outputs

```text
packages/core/dist/
├── index.js
├── index.cjs
├── index.d.ts
├── barcodesdk.esm.js
├── barcodesdk.min.js
└── *.map
```

The exact output layout can be adjusted to avoid duplicate or unnecessary artifacts. Package exports must point to valid files.

### 10.3 React npm outputs

```text
packages/react/dist/
├── index.js
├── index.cjs
├── index.d.ts
└── *.map
```

### 10.4 Module formats

Core package:

- ESM for modern bundlers.
- CommonJS for compatible Node-based tooling and consumers.
- Browser ESM for module-based CDN use.
- Standalone IIFE for classic script-tag CDN use.

React package:

- ESM and CommonJS npm builds.
- React and ReactDOM externalized as peer dependencies.
- No React dependency bundled into the core package.

### 10.5 CDN global

The classic script build should expose a documented global:

```js
window.BarcodeSDK
```

Example:

```html
<script src="https://cdn.jsdelivr.net/npm/@barcodesdk/core@1.0.0/dist/barcodesdk.min.js"></script>

<script>
  const scanner = new BarcodeSDK.BarcodeScanner({
    detection: {
      multiple: true
    }
  });
</script>
```

Use version-pinned CDN URLs in production documentation. The IIFE build must bundle its required runtime dependencies and must not rely on unresolved bare module imports.

### 10.6 Package metadata

- Use `exports` to define public entry points.
- Include declaration files.
- Include only distributable files in npm packages.
- Use `sideEffects: false` only if the package is genuinely free of required import-time side effects.
- Provide source maps where appropriate.
- Verify package contents using `npm pack --dry-run` or an equivalent package inspection step.
- Test installation from the packed tarball, not only workspace imports.

### 10.7 Dependency management

Do not assume package versions are compatible merely because they exist. Before implementation:

1. Inspect current stable versions of the selected ZXing packages.
2. Verify their peer/dependency compatibility.
3. Pin and lock the tested dependency graph.
4. Record license notices.
5. Add a CI check for dependency and build compatibility.

---

## 11. Performance requirements

Performance targets are release goals to be measured on a documented reference device and dataset, not universal guarantees.

- No overlapping decode operations within one scanner instance.
- Configurable scan interval and processing dimensions.
- No unbounded frame queue.
- Multi-region scanning must respect configured region/depth/time limits.
- Avoid unnecessary allocations and repeated canvas creation.
- Release camera and image resources reliably.
- Measure latency for one barcode and multiple barcodes separately.
- Measure memory behavior during repeated start/stop cycles.

### 11.1 Web Worker

Worker processing is an optional optimization, not a prerequisite for the first working release.

If implemented:

- Keep DOM and camera stream management on the main thread.
- Transfer supported image/frame data to the worker efficiently.
- Define worker initialization and teardown.
- Provide a main-thread fallback.
- Document Content Security Policy and worker asset requirements.
- Verify the CDN build can locate and load its worker assets reliably.

Do not enable worker mode by default until it is stable across supported bundlers and browsers.

---

## 12. Error handling

Expose typed, documented errors. Initial error categories should include:

- `CAMERA_PERMISSION_DENIED`
- `CAMERA_NOT_FOUND`
- `CAMERA_IN_USE`
- `CAMERA_CONSTRAINT_NOT_SUPPORTED`
- `CAMERA_START_FAILED`
- `DECODER_NOT_INITIALIZED`
- `IMAGE_LOAD_FAILED`
- `UNSUPPORTED_FORMAT`
- `SCAN_FAILED`
- `SCANNER_DESTROYED`
- `UNSUPPORTED_BROWSER`

A no-barcode-found outcome is not an error. Errors must include actionable messages without exposing sensitive image or camera data.

---

## 13. Security, privacy, and licensing

- Camera and image processing must be local by default.
- No camera frame or uploaded image may be transmitted to a BarcodeSDK server.
- Do not add analytics or telemetry without a separately documented opt-in.
- Do not store scanned barcode values persistently unless the consuming application chooses to do so.
- Explain camera permissions and HTTPS requirements.
- Review licenses for ZXing and all transitive dependencies before commercial release.
- Include required third-party license notices in npm and CDN distributions.
- Do not claim that minification or bundling protects proprietary code from reverse engineering.

---

## 14. Testing and quality assurance

### 14.1 Unit tests

Test:

- Configuration validation.
- Decoder adapter normalization.
- Result aggregation.
- Deduplication.
- Coordinate transformation.
- Region generation and bounds.
- Event subscription and unsubscription.
- Lifecycle and cleanup.
- Error mapping.

### 14.2 Barcode image fixtures

Create a labeled test dataset covering:

- Each claimed barcode format.
- Single barcode images.
- Images with 2, 5, and 10+ barcodes.
- Mixed 1D and 2D formats.
- Different barcode sizes and spacing.
- Rotated barcodes.
- Low-light and blurred images.
- Perspective distortion.
- Partial obstruction.
- Medical product packaging where permitted.

Ground-truth annotations should include format, decoded value, and bounding box where applicable.

### 14.3 Multi-barcode metrics

Measure and report:

- Barcode recall: percentage of ground-truth barcodes detected.
- Precision: percentage of returned results that are valid.
- False positives.
- Duplicate result rate.
- Bounding-box localization quality where boxes are available.
- Processing latency by image size and number of barcodes.

Do not use only hand-picked successful examples. Include difficult and negative images.

### 14.4 Browser and device matrix

Test current supported versions of:

- Chrome desktop and Android.
- Safari macOS and iOS.
- Firefox desktop.
- Edge desktop.

Test:

- Camera permission grant and denial.
- Camera switching.
- Device camera removal.
- Repeated start/stop.
- Background tab behavior.
- Orientation changes.
- Low-resolution and high-resolution cameras.
- CDN and npm integration.
- Next.js production build and SSR behavior.

The official support matrix must reflect actual test results.

---

## 15. Documentation and examples

The documentation site must include:

1. Installation.
2. Browser compatibility and requirements.
3. Vanilla JavaScript quick start.
4. React quick start.
5. Next.js App Router integration.
6. Vue integration example.
7. Angular integration example.
8. Camera permissions and HTTPS.
9. Supported barcode formats.
10. Multiple barcode detection behavior and limitations.
11. Image upload scanning.
12. Camera switching and torch capability detection.
13. Result and coordinate model.
14. Error handling.
15. CDN installation.
16. Build formats and package exports.
17. Privacy and third-party licenses.
18. Troubleshooting.

Examples must be executable and tested. Do not publish examples that rely on APIs not included in the released package.

---

## 16. CI/CD and release process

### 16.1 Pull request checks

Every pull request should run:

- Formatting and linting.
- TypeScript checks.
- Unit tests.
- Package builds.
- Package export validation.
- React peer dependency validation.
- Browser integration tests where practical.
- Next.js production build.
- License/dependency checks.

### 16.2 Release checks

Before publishing:

1. Verify the version and changelog.
2. Run the complete test suite.
3. Build all package formats.
4. Inspect packed npm artifacts.
5. Install and test the packed packages in clean example projects.
6. Test the CDN IIFE and ESM files from a browser.
7. Verify declaration files.
8. Verify license notices.
9. Publish core before React when the React release depends on the new core version.
10. Create a tagged release and publish release notes.

Use semantic versioning:

- Patch: compatible fixes.
- Minor: backward-compatible features.
- Major: breaking public API changes.

---

## 17. Acceptance criteria

The initial production release is acceptable only when all mandatory criteria pass.

### Core

- [ ] Core package has no React or framework dependency.
- [ ] Browser globals are not accessed during server-side module evaluation.
- [ ] Camera start, stop, pause, resume, and destroy work.
- [ ] Image scanning works for supported input types.
- [ ] Barcode results use the documented common result model.
- [ ] Errors are typed and documented.
- [ ] Camera streams and scheduled processing are cleaned up.

### Multi-barcode

- [ ] Multiple barcodes can be returned from a single image when present and decodable.
- [ ] The multi-region algorithm has bounded work.
- [ ] Duplicate results are filtered according to configuration.
- [ ] Coordinates are mapped to the original image/frame.
- [ ] Missing geometry is represented honestly.
- [ ] Recall, precision, latency, and false-positive measurements are recorded.
- [ ] Public claims match measured results.

### React and frameworks

- [ ] React component and hook work.
- [ ] React Strict Mode does not leave duplicate camera sessions.
- [ ] React unmount cleans up the scanner.
- [ ] Next.js production build succeeds.
- [ ] Vanilla JavaScript integration works.
- [ ] Framework-neutral core can be used by Vue, Angular, and Svelte examples.

### Distribution

- [ ] ESM npm build works.
- [ ] CommonJS npm build works where supported.
- [ ] Type declarations resolve correctly.
- [ ] React peer dependencies are correct.
- [ ] CDN ESM build works.
- [ ] CDN IIFE exposes `BarcodeSDK`.
- [ ] CDN build includes required runtime dependencies.
- [ ] Packed npm artifacts install in a clean project.

### Release

- [ ] Documentation is complete.
- [ ] License notices are included.
- [ ] CI checks pass.
- [ ] Versioned release notes are prepared.

---

## 18. Implementation phases

### Phase 1 — Monorepo foundation

Deliver:

- PNPM workspace.
- Turborepo configuration.
- Shared TypeScript configuration.
- Core and React package skeletons.
- Linting, formatting, and test setup.
- CI build pipeline.

**Exit condition:** Clean install, workspace build, and type checks pass.

### Phase 2 — Core single-barcode scanning

Deliver:

- ZXing decoder adapter.
- Camera manager.
- Image scanner.
- Scanner lifecycle.
- Event emitter.
- Standard result and error types.

**Exit condition:** Camera and image scanning work for the validated initial format set.

### Phase 3 — Multi-barcode detection

Deliver:

- Region scanner.
- Image tiling/recursive subdivision.
- Coordinate mapping.
- Result aggregation.
- Deduplication.
- Labeled test dataset and benchmark report.

**Exit condition:** Multi-barcode performance is measured and meets the release thresholds approved by the product owner.

### Phase 4 — React and framework integration

Deliver:

- React component.
- React hook.
- Next.js example.
- Vanilla JavaScript example.
- Vue and Angular integration examples.

**Exit condition:** Framework lifecycle and SSR tests pass.

### Phase 5 — Bundling and distribution

Deliver:

- ESM and CommonJS npm builds.
- Browser ESM and IIFE CDN builds.
- Type declarations.
- Package export validation.
- npm publishing workflow.

**Exit condition:** Clean package installation and CDN browser tests pass.

### Phase 6 — Production hardening

Deliver:

- Browser/device compatibility testing.
- Performance and memory benchmarks.
- Security and license review.
- Documentation and troubleshooting.
- Release notes and versioned release.

**Exit condition:** All mandatory acceptance criteria pass.

---

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| ZXing JS does not expose Java multi-reader functionality | Implement and benchmark custom region-based rescanning |
| Multi-region scanning increases latency | Bound regions/depth, resize frames, benchmark and expose configuration |
| Closely packed barcodes are missed | Use overlapping tiles and a labeled challenging dataset |
| Decoder does not provide a full bounding box | Return available points; do not fabricate geometry |
| Browser camera differences | Feature detection, graceful errors, browser/device test matrix |
| Next.js SSR import errors | No browser-global access at module scope; production SSR tests |
| CDN dependency/worker loading issues | Standalone IIFE, pinned assets, real browser CDN tests |
| ZXing maintenance status | Pin tested versions, monitor upstream, maintain adapter tests and assess fork strategy |
| Bundle size grows | Measure minified/gzipped size, inspect dependency graph, avoid duplicate ZXing copies |

---

## 20. Decisions required before implementation is considered complete

These are product-owner decisions that must be resolved during the relevant phase:

1. Minimum acceptable multi-barcode recall and precision for the target packaging dataset.
2. Maximum acceptable scan latency on a named reference desktop and mobile device.
3. Initial maximum number of barcodes returned per frame.
4. Initial supported browser/version matrix.
5. Whether worker mode is included in the first public release or deferred.
6. Whether the React package includes a default visual scanner UI or only a headless component/hook plus optional UI.
7. Commercial licensing and package ownership details.

Do not invent these thresholds. Propose values based on a benchmark and obtain approval before using them as release gates.

---

## 21. Cursor implementation instructions

Use this PRD as the source of truth when implementing BarcodeSDK in Cursor.

### Required working approach

1. Inspect the existing repository before changing files.
2. If the repository is empty, create the monorepo described in this document.
3. Implement in phases; do not generate the entire product in one unreviewed pass.
4. Keep the core package framework-independent.
5. Keep ZXing behind an internal adapter.
6. Do not expose ZXing-specific classes as public API.
7. Do not claim multi-barcode support until the multi-region implementation passes the labeled test suite.
8. Do not fabricate barcode bounding boxes.
9. Add tests alongside each feature.
10. Run type checks, tests, and builds after each meaningful phase.
11. Avoid placeholder implementations that appear production-ready.
12. Document limitations and unresolved product decisions.
13. Prefer small, reviewable changes over large rewrites.
14. Do not publish npm packages or deploy CDN assets without explicit release approval.

### First Cursor task

Start with **Phase 1 only**:

- Inspect the repository.
- Propose the workspace/package structure.
- Create PNPM and Turborepo configuration.
- Create TypeScript configurations.
- Create `@barcodesdk/core` and `@barcodesdk/react` package skeletons.
- Add Rollup build scripts and minimal valid entry points.
- Add linting, formatting, and test configuration.
- Verify clean installation, package builds, and type checks.
- Report the files created, commands run, test results, and any unresolved issues.

Do not implement camera scanning or multi-barcode detection until Phase 1 is verified.

---

**End of PRD**
