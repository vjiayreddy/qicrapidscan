#!/usr/bin/env node
/**
 * Phase 6 gate: licenses, SSR smoke, CDN smoke, pack verify, pack smoke, perf report present.
 * Assumes packages are already built where needed by sub-scripts.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

run("node scripts/check-licenses.mjs");
run("pnpm --filter @qicrapidscan/core build");
run("pnpm --filter @qicrapidscan/react build");
run("node scripts/verify-packages.mjs");
run("node scripts/ssr-smoke.mjs");
run("node scripts/cdn-smoke.mjs");
run("node scripts/pack-verify.mjs");
run("node scripts/pack-smoke.mjs");
run("node scripts/benchmark-perf.mjs");

const perf = resolve(ROOT, "docs/benchmarks/phase6-perf.json");
if (!existsSync(perf)) {
  throw new Error("phase6-perf.json missing after benchmark:perf");
}

console.log("\nPhase 6 verification passed.");
