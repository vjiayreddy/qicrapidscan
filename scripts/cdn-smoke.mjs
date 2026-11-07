#!/usr/bin/env node
/**
 * Load the IIFE build in happy-dom and assert window.QicRapidScan.BarcodeScanner.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iifePath = resolve(ROOT, "packages/core/dist/qicrapidscan.min.js");
const code = readFileSync(iifePath, "utf8");

const window = new Window({ url: "https://localhost/" });
const { document } = window;

// Provide minimal globals used during evaluation
window.eval(code);

const sdk = window.QicRapidScan;
if (!sdk) {
  throw new Error("window.QicRapidScan was not defined by the IIFE build");
}
if (typeof sdk.BarcodeScanner !== "function") {
  throw new Error("QicRapidScan.BarcodeScanner missing");
}
if (typeof sdk.BarcodeError !== "function") {
  throw new Error("QicRapidScan.BarcodeError missing");
}

const scanner = new sdk.BarcodeScanner({ formats: ["QR_CODE"] });
await scanner.destroy();

console.log("CDN IIFE smoke OK — window.QicRapidScan.BarcodeScanner");
window.close();
void document;
