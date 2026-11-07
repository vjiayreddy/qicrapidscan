# QicRapidScan

Client-side web barcode scanning SDK — framework-independent TypeScript core with React bindings.

**Product:** QicRapidScan  
**Technical PRD:** [docs/PRD.md](docs/PRD.md)  
**Changelog:** [CHANGELOG.md](CHANGELOG.md)  
**Legacy reference (read-only):** `/Users/vijay/Desktop/Projects/barcodesdk`

## Packages

| Package | Role |
|---|---|
| `@qicrapidscan/core` | Framework-independent scanner API |
| `@qicrapidscan/react` | React component + hooks |
| `@qicrapidscan/testing` | Internal fixtures |

## Docs

| Doc | Topic |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Install + quick starts |
| [docs/api.md](docs/api.md) | API overview |
| [docs/compatibility.md](docs/compatibility.md) | Browser / device matrix |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common failures |
| [docs/security-privacy.md](docs/security-privacy.md) | Privacy + licensing |
| [docs/release-checklist.md](docs/release-checklist.md) | Pre-publish gates |
| [docs/acceptance-criteria.md](docs/acceptance-criteria.md) | PRD §17 tracker |

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io) 10+

## Setup

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

## Playground / examples

```bash
pnpm playground                 # Next.js App Router demo (http://localhost:3000)
pnpm playground:build           # production build of playground
pnpm --filter @qicrapidscan/example-vanilla dev
pnpm --filter @qicrapidscan/example-react dev
pnpm --filter @qicrapidscan/example-vue dev
```

## Phase status

- **Phase 1:** Monorepo foundation — done
- **Phase 2:** Core single-barcode camera + image scanning — done
- **Phase 3:** Multi-barcode region detection + corpus metrics — done
- **Phase 4:** React lifecycle + framework examples — done
- **Phase 5:** CDN ESM + IIFE (`window.QicRapidScan`) + pack smoke — done
- **Phase 6:** Hardening, docs, release gates — done (npm publish blocked pending approval)

## Distribution / Phase 6 checks

```bash
pnpm verify:packages   # artifacts + exports + ESM/CJS import
pnpm cdn:smoke         # window.QicRapidScan in happy-dom
pnpm ssr:smoke         # no browser globals at import time
pnpm pack:verify       # pack contents
pnpm pack:smoke        # install tarballs in a clean consumer
pnpm check:licenses    # THIRD_PARTY notices packaged
pnpm benchmark:perf    # latency + bundle sizes → docs/benchmarks/phase6-perf.json
pnpm verify:phase6     # full Phase 6 gate (no npm publish)
```

## License

Private / unpublished until an explicit release decision. Third-party notices: [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
