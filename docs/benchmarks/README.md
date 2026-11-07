# Benchmarks

Metrics are **informational** until product-owner gates are approved ([../open-decisions.md](../open-decisions.md)).

## Phase 3 multi-barcode

```bash
pnpm corpus:multi
pnpm benchmark:multi
```

Output: [`phase3-multi.json`](./phase3-multi.json)

Dense grids (9+ codes) may need higher `maxRegions` / `maxDepth` than live-scan defaults.

## Phase 6 performance / bundles

```bash
pnpm benchmark:perf
```

Output: [`phase6-perf.json`](./phase6-perf.json)

Includes:

- Single QR `decodeRaster` latency (p50 / p95)
- Multi-fixture latency when corpus is present
- Raw + gzip sizes for npm and CDN artifacts
- Node create/destroy heap delta (not a browser GC proof)
