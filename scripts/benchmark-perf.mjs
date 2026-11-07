#!/usr/bin/env node
/**
 * Phase 6 performance / bundle / memory-style benchmarks (informational).
 * Writes docs/benchmarks/phase6-perf.json
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { PNG } from "pngjs";
import QRCode from "qrcode";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_DIR = resolve(ROOT, "docs/benchmarks");
const FIXTURES = resolve(ROOT, "packages/testing/fixtures/multi");

function gzipSize(path) {
  const raw = readFileSync(path);
  return { bytes: raw.length, gzipBytes: gzipSync(raw).length };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const coreDist = resolve(ROOT, "packages/core/dist");
  const bundles = {};
  for (const name of [
    "index.js",
    "index.cjs",
    "qicrapidscan.esm.js",
    "qicrapidscan.js",
    "qicrapidscan.min.js",
  ]) {
    const path = join(coreDist, name);
    if (!existsSync(path)) {
      throw new Error(`Missing ${path} — run core build first`);
    }
    bundles[name] = { ...gzipSize(path), path: `packages/core/dist/${name}` };
  }

  const core = await import(pathToFileURL(join(coreDist, "index.js")).href);
  const { BarcodeScanner, createDefaultDecoder, detectMultipleFromRaster } = core;

  const qrBuf = await QRCode.toBuffer("PERF-SINGLE-001", {
    type: "png",
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const png = PNG.sync.read(qrBuf);
  const raster = {
    width: png.width,
    height: png.height,
    data: Uint8ClampedArray.from(png.data),
  };

  const decoder = createDefaultDecoder(["QR_CODE"]);
  const singleSamples = [];
  let decodedOk = 0;
  for (let i = 0; i < 20; i += 1) {
    const t0 = performance.now();
    const result = decoder.decodeRaster(raster);
    const elapsed = performance.now() - t0;
    if (result) decodedOk += 1;
    if (i >= 5) singleSamples.push(elapsed);
  }
  singleSamples.sort((a, b) => a - b);

  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 50; i += 1) {
    const s = new BarcodeScanner({ formats: ["QR_CODE"] });
    await s.destroy();
  }
  const memAfter = process.memoryUsage().heapUsed;

  let multi = null;
  const manifestPath = join(FIXTURES, "manifest.json");
  if (existsSync(manifestPath) && detectMultipleFromRaster) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const multiDecoder = createDefaultDecoder(["QR_CODE"]);
    const limits = {
      maxResults: 20,
      maxRegions: 48,
      maxDepth: 4,
      overlap: 0.25,
      maxTimeMs: 3000,
    };
    const samples = [];
    for (const entry of manifest.cases) {
      const pngPath = join(FIXTURES, entry.image);
      if (!existsSync(pngPath)) continue;
      const page = PNG.sync.read(readFileSync(pngPath));
      const pageRaster = {
        width: page.width,
        height: page.height,
        data: Uint8ClampedArray.from(page.data),
      };
      const t0 = performance.now();
      detectMultipleFromRaster(multiDecoder, pageRaster, limits);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    multi = {
      n: samples.length,
      p50Ms: percentile(samples, 50),
      p95Ms: percentile(samples, 95),
      maxMs: samples[samples.length - 1] ?? null,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    note: "Informational Phase 6 metrics. Latency/memory gates require product-owner approval (PRD §20).",
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    bundles,
    singleQrDecodeRaster: {
      samples: singleSamples.length,
      decodedOk,
      p50Ms: percentile(singleSamples, 50),
      p95Ms: percentile(singleSamples, 95),
      maxMs: singleSamples[singleSamples.length - 1] ?? null,
    },
    createDestroyCycles: {
      iterations: 50,
      heapDeltaBytes: memAfter - memBefore,
      note: "Node heapUsed delta only; not a browser memory proof",
    },
    multiFixture: multi,
    proposals: {
      singleP95Ms: 100,
      multiP95Ms: 250,
      cdnMinGzipKb: 350,
    },
  };

  const out = join(REPORT_DIR, "phase6-perf.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Wrote ${out}`);
  console.log(
    `single decodeRaster p50=${Number(report.singleQrDecodeRaster.p50Ms).toFixed(2)}ms ` +
      `p95=${Number(report.singleQrDecodeRaster.p95Ms).toFixed(2)}ms decodedOk=${decodedOk}`,
  );
  if (multi) {
    console.log(
      `multi fixture p50=${Number(multi.p50Ms).toFixed(1)}ms p95=${Number(multi.p95Ms).toFixed(1)}ms`,
    );
  }
  console.log(
    `CDN min: ${(bundles["qicrapidscan.min.js"].gzipBytes / 1024).toFixed(1)} KiB gzip`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
