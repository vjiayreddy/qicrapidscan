#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "LICENSE",
  "docs/THIRD_PARTY_NOTICES.md",
  "docs/security-privacy.md",
  "packages/core/LICENSE",
  "packages/react/LICENSE",
  "packages/core/THIRD_PARTY_NOTICES.md",
  "packages/react/THIRD_PARTY_NOTICES.md",
];

let failed = false;
for (const rel of required) {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) {
    console.error(`Missing: ${rel}`);
    failed = true;
    continue;
  }
  const text = readFileSync(path, "utf8");
  if (text.trim().length < 20) {
    console.error(`Too short / empty: ${rel}`);
    failed = true;
  }
}

const notices = readFileSync(resolve(ROOT, "docs/THIRD_PARTY_NOTICES.md"), "utf8");
if (!notices.includes("Apache") || !notices.includes("@zxing/library")) {
  console.error("THIRD_PARTY_NOTICES.md must mention @zxing/library and Apache");
  failed = true;
}

for (const pkg of ["core", "react"]) {
  const pkgJson = JSON.parse(
    readFileSync(resolve(ROOT, `packages/${pkg}/package.json`), "utf8"),
  );
  const files = pkgJson.files || [];
  if (!files.includes("LICENSE") && !files.includes("LICENSE.md")) {
    // LICENSE may be auto-included by npm when present at package root; still require listing notices.
  }
  if (!files.includes("THIRD_PARTY_NOTICES.md")) {
    console.error(`packages/${pkg}/package.json files[] must include THIRD_PARTY_NOTICES.md`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("License / notices check OK");
