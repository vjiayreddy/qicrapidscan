# Release checklist

Do **not** publish npm or deploy CDN assets without explicit approval.

## Pre-release

1. [ ] Resolve open decisions that affect gates ([open-decisions.md](./open-decisions.md)).
2. [ ] Bump versions in `packages/core` and `packages/react` (semver).
3. [ ] Update `CHANGELOG.md` for the release version.
4. [ ] Confirm `LICENSE` / commercial terms for public distribution.
5. [ ] Ensure `THIRD_PARTY_NOTICES.md` is packaged (`files` field).

## Verify

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:phase6
pnpm playground:build
```

Manual:

1. [ ] Camera grant/deny on at least one desktop and one mobile browser.
2. [ ] CDN IIFE page loads `QicRapidScan.BarcodeScanner`.
3. [ ] Inspect `pnpm pack` / `npm pack --dry-run` contents for core + react.
4. [ ] Install packed tarballs in a clean project (`pnpm pack:smoke`).

## Publish order (when approved)

1. Publish `@qicrapidscan/core`.
2. Publish `@qicrapidscan/react` (depends on released core version, not `workspace:*`).
3. Tag `vX.Y.Z` and attach release notes from `CHANGELOG.md`.
4. Pin CDN URLs to that version.

## Rollback

Unpublish is generally not available for established versions — prefer a follow-up patch release.
