# Changelog

All notable changes to QicRapidScan are documented here.

## [0.0.0] - 2026-11-07 (pre-release)

Initial monorepo implementation through Phase 6 hardening. **Not published** to npm.

### Added

- `@qicrapidscan/core` — camera + image scanning, multi-barcode region detection, typed errors, ZXing adapter
- `@qicrapidscan/react` — `<BarcodeScanner />`, `useBarcodeScanner`, Strict Mode–safe lifecycle
- CDN builds: `qicrapidscan.esm.js`, `qicrapidscan.js`, `qicrapidscan.min.js` → `window.QicRapidScan`
- Playground (Next.js), vanilla/react/vue examples, Angular integration notes
- Labeled multi-barcode corpus + benchmarks
- Pack/CDN/SSR smoke scripts, third-party notices, compatibility and troubleshooting docs
- Phase 6 release checklist and acceptance tracker

### Notes

- Package versions remain `0.0.0` / `private: true` until an explicit public release.
- Multi-barcode metrics are informational; product-owner gates are open ([docs/open-decisions.md](./docs/open-decisions.md)).
- Worker mode deferred for the first public release.
