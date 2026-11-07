# Acceptance criteria tracker (PRD §17)

Status as of Phase 6 hardening. Items marked **blocked** wait on product-owner decisions in [open-decisions.md](./open-decisions.md).

## Core

| Criterion | Status | Evidence |
|---|---|---|
| Core has no React/framework dependency | Pass | `packages/core/package.json` deps |
| No browser globals at SSR module eval | Pass | `pnpm ssr:smoke` |
| Camera start/stop/pause/resume/destroy | Pass | Unit tests + playground |
| Image scanning for supported inputs | Pass | Core tests / image path |
| Documented common result model | Pass | [api.md](./api.md) |
| Typed documented errors | Pass | `BarcodeError` + troubleshooting |
| Streams / scheduled work cleaned up | Pass | destroy/unmount tests |

## Multi-barcode

| Criterion | Status | Evidence |
|---|---|---|
| Multiple barcodes from one image | Pass | Corpus + detector tests |
| Bounded multi-region work | Pass | `maxRegions` / `maxDepth` / `maxTimeMs` |
| Duplicate filtering | Pass | Deduplicator tests |
| Coordinates mapped to original | Pass | coordinates tests |
| Missing geometry honest | Pass | optional `boundingBox` / `points` |
| Recall/precision/latency recorded | Pass | `docs/benchmarks/phase3-multi.json` |
| Public claims match measurements | Pass | Docs state informational / no inflated claims |

## React and frameworks

| Criterion | Status | Evidence |
|---|---|---|
| React component + hook | Pass | `packages/react` tests |
| Strict Mode no duplicate sessions | Pass | hook tests |
| Unmount cleans up | Pass | hook tests |
| Next.js production build | Pass | `pnpm playground:build` |
| Vanilla integration | Pass | `examples/vanilla` |
| Vue/Angular/Svelte via core | Pass | examples + READMEs |

## Distribution

| Criterion | Status | Evidence |
|---|---|---|
| ESM npm build | Pass | `pnpm verify:packages` |
| CJS npm build | Pass | `pnpm verify:packages` |
| Type declarations | Pass | `dist/index.d.ts` |
| React peer deps | Pass | `peerDependencies` ≥18 |
| CDN ESM | Pass | verify + cdn smoke |
| CDN IIFE global | Pass | `window.QicRapidScan` (renamed from PRD `BarcodeSDK`) |
| CDN includes runtime deps | Pass | ZXing bundled in CDN builds |
| Packed tarball install | Pass | `pnpm pack:smoke` |

## Release

| Criterion | Status | Evidence |
|---|---|---|
| Documentation complete | Pass | `docs/*` + package READMEs |
| License notices included | Pass | `THIRD_PARTY_NOTICES.md` in packages |
| CI checks | Pass | `.github/workflows/ci.yml` (+ Phase 6 steps) |
| Versioned release notes | Pass | `CHANGELOG.md` (pre-release) |
| npm/CDN publish | **Blocked** | Explicit approval required; not performed |

## Gate summary

Automated Phase 6 gate: `pnpm verify:phase6`.

Hard numeric latency/recall gates remain **proposed only** until §20 approval.
