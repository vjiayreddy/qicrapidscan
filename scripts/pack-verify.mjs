#!/usr/bin/env node
/**
 * pnpm pack dry-run + inspect packaged file lists for core/react.
 */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "tmp/pack");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

function pack(pkgDir, name) {
  // pnpm pack rewrites workspace:* deps; --json-only lists contents without writing tgz in newer pnpm.
  // Fall back to --dry-run style via packing then reading npm pack --dry-run equivalent.
  const json = execSync("pnpm pack --json", {
    cwd: pkgDir,
    encoding: "utf8",
  });
  // pnpm pack --json prints the filename path; use npm pack --dry-run --json after rewriting via a temp approach.
  // Simpler: run npm pack --dry-run after pnpm publish --dry-run isn't available.
  // Use `pnpm pack` then inspect with tar, but for dry-run content listing:
  const dry = execSync("npm pack --dry-run --json", {
    cwd: pkgDir,
    encoding: "utf8",
  });
  void json;
  const parsed = JSON.parse(dry);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const files = (entry.files || []).map((f) => f.path || f);
  writeFileSync(resolve(OUT, `${name}-files.json`), JSON.stringify(files, null, 2));

  const mustInclude = ["dist/index.js", "dist/index.cjs", "dist/index.d.ts", "package.json"];
  for (const file of mustInclude) {
    if (!files.some((f) => f === file || f.endsWith(`/${file}`))) {
      throw new Error(`${name}: packed tarball missing ${file}`);
    }
  }

  if (name === "core") {
    for (const file of [
      "dist/qicrapidscan.min.js",
      "dist/qicrapidscan.esm.js",
      "dist/qicrapidscan.js",
    ]) {
      if (!files.includes(file)) {
        throw new Error(`${name}: packed tarball missing CDN artifact ${file}`);
      }
    }
  }

  if (files.some((f) => f.includes(".test.ts"))) {
    throw new Error(`${name}: test sources should not be packed`);
  }

  console.log(`${name}: pack dry-run OK (${files.length} files)`);
}

pack(resolve(ROOT, "packages/core"), "core");
pack(resolve(ROOT, "packages/react"), "react");
console.log(`file lists written under ${OUT}`);
