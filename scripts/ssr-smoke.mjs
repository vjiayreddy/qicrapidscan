#!/usr/bin/env node
/**
 * Prove package entry evaluation works in Node without a DOM.
 * ZXing may feature-detect `typeof window` safely when undefined — we do not
 * install throwing getters (that would false-positive on dependency probes).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const name of ["window", "document", "navigator"]) {
  if (typeof globalThis[name] !== "undefined") {
    throw new Error(`SSR smoke expected globalThis.${name} to be undefined in Node`);
  }
}

const core = await import(pathToFileURL(resolve(ROOT, "packages/core/dist/index.js")).href);
if (typeof core.BarcodeScanner !== "function") {
  throw new Error("SSR smoke: BarcodeScanner missing from core ESM");
}

const require = createRequire(import.meta.url);
const coreCjs = require(resolve(ROOT, "packages/core/dist/index.cjs"));
if (typeof coreCjs.BarcodeScanner !== "function") {
  throw new Error("SSR smoke: BarcodeScanner missing from core CJS");
}

const react = await import(pathToFileURL(resolve(ROOT, "packages/react/dist/index.js")).href);
if (typeof react.useBarcodeScanner !== "function") {
  throw new Error("SSR smoke: react useBarcodeScanner missing");
}

for (const name of ["window", "document", "navigator"]) {
  if (typeof globalThis[name] !== "undefined") {
    throw new Error(`SSR smoke: import defined globalThis.${name}`);
  }
}

const scanner = new core.BarcodeScanner({ formats: ["QR_CODE"] });
await scanner.destroy();

console.log("SSR smoke OK — core/react import in Node without DOM; destroy works");
