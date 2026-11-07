# Multiple barcode detection

Enable with:

```ts
new BarcodeScanner({
  formats: ["QR_CODE"],
  detection: {
    multiple: true,
    maxResults: 10,
    maxRegions: 16,
    maxDepth: 2,
    overlap: 0.2,
    maxTimeMs: 250,
  },
});
```

## Behavior

- Uses bounded region / tile subdivision + deduplication (not ZXing’s Java multi-reader API).
- Work is capped by `maxRegions`, `maxDepth`, `maxResults`, and `maxTimeMs`.
- Coordinates map back to the original image/frame when geometry is available.
- Dense packs may need higher budgets than live-camera defaults.

## Measured corpus (informational)

Run:

```bash
pnpm corpus:multi
pnpm benchmark:multi
```

Latest snapshot: [benchmarks/phase3-multi.json](./benchmarks/phase3-multi.json).

Product-owner recall/precision **release gates are not set** yet — see [open-decisions.md](./open-decisions.md). Do not advertise unmeasured accuracy.
