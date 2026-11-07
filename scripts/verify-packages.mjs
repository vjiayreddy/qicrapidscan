#!/usr/bin/env node
/**
 * Phase 5: validate build artifacts and package exports map.
 */
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const requiredFiles = [
  "packages/core/dist/index.js",
  "packages/core/dist/index.cjs",
  "packages/core/dist/index.d.ts",
  "packages/core/dist/qicrapidscan.esm.js",
  "packages/core/dist/qicrapidscan.js",
  "packages/core/dist/qicrapidscan.min.js",
  "packages/react/dist/index.js",
  "packages/react/dist/index.cjs",
  "packages/react/dist/index.d.ts",
];

const missing = [];
for (const rel of requiredFiles) {
  try {
    await access(resolve(ROOT, rel));
  } catch {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  console.error("Missing build outputs:\n" + missing.map((m) => ` - ${m}`).join("\n"));
  process.exit(1);
}

function assertExports(pkgPath, expectedKeys) {
  const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf8"));
  if (!pkg.exports || typeof pkg.exports !== "object") {
    throw new Error(`${pkg.name}: missing exports`);
  }
  for (const key of expectedKeys) {
    if (!(key in pkg.exports)) {
      throw new Error(`${pkg.name}: missing exports["${key}"]`);
    }
  }
  console.log(`exports OK: ${pkg.name}`);
}

assertExports(resolve(ROOT, "packages/core/package.json"), [".", "./cdn", "./package.json"]);
assertExports(resolve(ROOT, "packages/react/package.json"), [".", "./package.json"]);

// ESM import smoke
const core = await import(pathToFileURL(resolve(ROOT, "packages/core/dist/index.js")).href);
if (typeof core.BarcodeScanner !== "function") {
  throw new Error("ESM BarcodeScanner missing");
}
console.log("ESM import OK: BarcodeScanner");

// CJS require smoke
const coreCjs = require(resolve(ROOT, "packages/core/dist/index.cjs"));
if (typeof coreCjs.BarcodeScanner !== "function") {
  throw new Error("CJS BarcodeScanner missing");
}
console.log("CJS require OK: BarcodeScanner");

// CDN ESM has no bare imports of @zxing/library
const cdnEsm = await readFile(resolve(ROOT, "packages/core/dist/qicrapidscan.esm.js"), "utf8");
if (cdnEsm.includes('from "@zxing/library"') || cdnEsm.includes("from '@zxing/library'")) {
  throw new Error("CDN ESM still has bare @zxing/library import — must be bundled");
}
console.log("CDN ESM bundle OK (no bare ZXing import)");

const iife = await readFile(resolve(ROOT, "packages/core/dist/qicrapidscan.min.js"), "utf8");
if (!iife.includes("QicRapidScan")) {
  throw new Error("IIFE missing QicRapidScan global name");
}
console.log("CDN IIFE OK");

console.log("Package verification passed.");
