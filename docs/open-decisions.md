# Open product decisions (PRD §20)

These must be approved by the product owner before they become hard release gates. Values below are **proposals** from Phase 3/6 measurements — not approved gates.

| # | Decision | Proposal | Status |
|---|---|---|---|
| 1 | Min multi-barcode recall / precision | Propose ≥ 0.75 recall and ≥ 0.95 precision on the labeled `multi/` corpus at documented limits; current snapshot ~0.76 / 1.00 | Awaiting approval |
| 2 | Max scan latency | Propose p95 image single-QR &lt; 100 ms and multi (≤4) &lt; 250 ms on reference desktop Node/canvas path; mobile camera TBD | Awaiting approval |
| 3 | Max barcodes per frame | Propose default `maxResults: 10` | Implemented as default-configurable; awaiting formal lock |
| 4 | Browser matrix | See [compatibility.md](./compatibility.md) proposed table | Awaiting device-lab sign-off |
| 5 | Worker mode in first public release | **Defer** workers | Proposed |
| 6 | React default visual UI vs headless | Ship both: visual `<BarcodeScanner />` + headless `useBarcodeScanner` | Implemented; awaiting formal lock |
| 7 | Commercial licensing / ownership | Proprietary unpublished until explicit release | Open |

Reference device for automated benches: CI Ubuntu + local macOS Node 20 (not a substitute for mobile camera timing).
