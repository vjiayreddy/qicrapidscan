#!/usr/bin/env node
/**
 * Create real tarballs with pnpm pack (rewrites workspace:*) and install in a clean consumer.
 */
import { execSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "tmp/pack-smoke");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

run("pnpm --filter @qicrapidscan/core build", ROOT);
run("pnpm --filter @qicrapidscan/react build", ROOT);

const coreDir = resolve(ROOT, "packages/core");
const reactDir = resolve(ROOT, "packages/react");

// pnpm pack writes <name>-<version>.tgz into the package directory and rewrites workspace deps.
const corePackName = execSync("pnpm pack", { cwd: coreDir, encoding: "utf8" }).trim().split("\n").pop();
const reactPackName = execSync("pnpm pack", { cwd: reactDir, encoding: "utf8" }).trim().split("\n").pop();

const coreSrc = resolve(coreDir, corePackName || "");
const reactSrc = resolve(reactDir, reactPackName || "");
const coreTgz = join(OUT, "core.tgz");
const reactTgz = join(OUT, "react.tgz");
copyFileSync(coreSrc, coreTgz);
copyFileSync(reactSrc, reactTgz);
rmSync(coreSrc, { force: true });
rmSync(reactSrc, { force: true });

// Ensure react tarball depends on packed core version, not workspace:*.
// pnpm pack should already rewrite to "0.0.0"; consumer installs both via file: urls.
const consumer = resolve(OUT, "consumer");
mkdirSync(consumer, { recursive: true });
writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "qicrapidscan-pack-smoke-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@qicrapidscan/core": `file:${coreTgz}`,
        "@qicrapidscan/react": `file:${reactTgz}`,
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
    },
    null,
    2,
  ),
);

writeFileSync(
  join(consumer, "smoke.mjs"),
  `import { BarcodeScanner, BarcodeError } from "@qicrapidscan/core";
import * as ReactPkg from "@qicrapidscan/react";

if (typeof BarcodeScanner !== "function") throw new Error("core BarcodeScanner missing");
if (typeof BarcodeError !== "function") throw new Error("core BarcodeError missing");
if (typeof ReactPkg.BarcodeScanner !== "function") throw new Error("react BarcodeScanner missing");
if (typeof ReactPkg.useBarcodeScanner !== "function") throw new Error("react hook missing");

const scanner = new BarcodeScanner({ formats: ["QR_CODE"] });
await scanner.destroy();
console.log("pack smoke OK");
`,
);

run("npm install --no-fund --no-audit", consumer);

// If react still resolves workspace protocol somehow, fail clearly by inspecting its package.json
const installedReactPkg = JSON.parse(
  readFileSync(join(consumer, "node_modules/@qicrapidscan/react/package.json"), "utf8"),
);
if (String(installedReactPkg.dependencies?.["@qicrapidscan/core"] || "").includes("workspace:")) {
  throw new Error("Packed react still has workspace:* dependency — pnpm pack rewrite failed");
}

run("node smoke.mjs", consumer);
console.log("Pack smoke passed.");
void readdirSync;
