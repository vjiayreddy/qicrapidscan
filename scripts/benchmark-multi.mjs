#!/usr/bin/env node
/**
 * Phase 3 multi-barcode benchmark against labeled fixtures.
 * Reports recall / precision / latency. Thresholds are informational until product-owner gates are set.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = resolve(ROOT, "packages/testing/fixtures/multi");
const REPORT_DIR = resolve(ROOT, "docs/benchmarks");

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function matchResults(groundTruth, predicted) {
  const used = new Set();
  let tp = 0;
  for (const gt of groundTruth) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < predicted.length; i += 1) {
      if (used.has(i)) continue;
      const p = predicted[i];
      if (p.text !== gt.text || p.format !== gt.format) continue;
      const score = p.boundingBox && gt.boundingBox ? iou(p.boundingBox, gt.boundingBox) : 1;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      tp += 1;
    }
  }
  const fp = predicted.length - tp;
  const fn = groundTruth.length - tp;
  return { tp, fp, fn };
}

async function main() {
  if (!existsSync(join(FIXTURES, "manifest.json"))) {
    console.error("Fixtures missing. Run: pnpm corpus:multi");
    process.exit(1);
  }

  const core = await import(
    pathToFileURL(resolve(ROOT, "packages/core/dist/index.js")).href
  );
  const { createDefaultDecoder, detectMultipleFromRaster } = core;
  if (!createDefaultDecoder || !detectMultipleFromRaster) {
    console.error("Rebuild @qicrapidscan/core — missing Phase 3 exports.");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(join(FIXTURES, "manifest.json"), "utf8"));
  const decoder = createDefaultDecoder(["QR_CODE"]);
  const limits = {
    maxResults: 20,
    maxRegions: 48,
    maxDepth: 4,
    overlap: 0.25,
    maxTimeMs: 3000,
  };

  const rows = [];
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const item of manifest.cases) {
    const meta = JSON.parse(readFileSync(join(FIXTURES, `${item.id}.json`), "utf8"));
    const png = PNG.sync.read(readFileSync(join(FIXTURES, item.image)));
    const raster = {
      width: png.width,
      height: png.height,
      data: Uint8ClampedArray.from(png.data),
    };

    const started = Date.now();
    const outcome = detectMultipleFromRaster(decoder, raster, limits);
    const elapsed = Date.now() - started;
    const match = matchResults(meta.groundTruth, outcome.results);
    tp += match.tp;
    fp += match.fp;
    fn += match.fn;

    rows.push({
      id: item.id,
      expected: meta.groundTruth.length,
      predicted: outcome.results.length,
      tp: match.tp,
      fp: match.fp,
      fn: match.fn,
      elapsedMs: elapsed,
      regionsScanned: outcome.stats.regionsScanned,
      stoppedReason: outcome.stats.stoppedReason,
      texts: outcome.results.map((r) => r.text),
    });
  }

  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    note: "Informational Phase 3 metrics. Product-owner recall/precision gates are not set yet (PRD §20).",
    totals: { tp, fp, fn, recall, precision },
    limits,
    cases: rows,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  const outFile = join(REPORT_DIR, "phase3-multi.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report.totals, null, 2));
  for (const row of rows) {
    console.log(
      `${row.id}: expected=${row.expected} predicted=${row.predicted} tp=${row.tp} ${row.elapsedMs}ms`,
    );
  }
  console.log(`report: ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
