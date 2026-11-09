#!/usr/bin/env node
/**
 * Stage YOLO pharma multi-barcode ONNX + onnxruntime-web WASM into the
 * playground public/ folder for hybrid image-upload localization.
 *
 * Usage (repo root):
 *   node scripts/stage-localizer-model.mjs
 *   QICRAPIDSCAN_LOCALIZER_MODEL_PATH=/path/to/model.onnx node scripts/stage-localizer-model.mjs
 *
 * Legal: Ultralytics YOLO exports are AGPL-3.0 — do not publish these weights
 * in the npm package without a separate license decision.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL_NAME = "pharma_multibarcodes.onnx";
/** Kept as optional fallback for single-class DataMatrix experiments. */
const LEGACY_MODEL_NAME = "datamatrix-model.onnx";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(root, "apps/playground/public");
const modelDestDir = join(publicRoot, "models");
const modelDest = join(modelDestDir, MODEL_NAME);
const ortDestDir = join(publicRoot, "assets/ort");

const modelCandidates = [
  process.env.QICRAPIDSCAN_LOCALIZER_MODEL_PATH?.trim() || "",
  join("/Users/vijay/Downloads", MODEL_NAME),
  join(root, "models", MODEL_NAME),
  join(modelDestDir, MODEL_NAME),
].filter(Boolean);

const modelSource = modelCandidates.find((path) => existsSync(path));
if (!modelSource) {
  console.error(`✗ Could not find ${MODEL_NAME}. Looked in:`);
  for (const path of modelCandidates) console.error(`  - ${path}`);
  console.error(
    "Set QICRAPIDSCAN_LOCALIZER_MODEL_PATH or place the file under ~/Downloads/.",
  );
  process.exit(1);
}

mkdirSync(modelDestDir, { recursive: true });
if (modelSource !== modelDest) {
  cpSync(modelSource, modelDest);
}
console.log(
  `Staged model → ${modelDest} (${statSync(modelDest).size} bytes)`,
);
console.log(
  "Classes: Code128, PDF417, QRCode, UPCA, datamatrix (input 1280×1280)",
);

// Preserve legacy single-class weights if present (do not fail if missing).
const legacyCandidates = [
  join("/Users/vijay/Downloads", LEGACY_MODEL_NAME),
  join(root, "models", LEGACY_MODEL_NAME),
  join(modelDestDir, LEGACY_MODEL_NAME),
];
const legacySource = legacyCandidates.find((path) => existsSync(path));
if (legacySource) {
  const legacyDest = join(modelDestDir, LEGACY_MODEL_NAME);
  if (legacySource !== legacyDest) {
    cpSync(legacySource, legacyDest);
  }
  console.log(`Also kept legacy model → ${legacyDest}`);
}

const require = createRequire(import.meta.url);
let ortDist;
try {
  const ortEntry = require.resolve("onnxruntime-web");
  ortDist = dirname(ortEntry);
} catch {
  console.error(
    "✗ onnxruntime-web is not installed. Run: pnpm add -Dw onnxruntime-web",
  );
  process.exit(1);
}

mkdirSync(ortDestDir, { recursive: true });
let copied = 0;
for (const file of readdirSync(ortDist)) {
  const keep =
    file === "ort.wasm.min.mjs" ||
    file === "ort.min.mjs" ||
    file === "ort.wasm.mjs" ||
    file === "ort.wasm.min.js" ||
    file === "ort.min.js" ||
    file.startsWith("ort-wasm") ||
    file.endsWith(".wasm");
  if (!keep) continue;
  cpSync(join(ortDist, file), join(ortDestDir, file));
  copied += 1;
}
console.log(`Copied ${copied} onnxruntime-web assets → ${ortDestDir}`);

// Stage OpenCV.js for the ROI recovery cascade (avoid Next/Webpack bundling
// the Node-oriented @techstark/opencv-js build that requires `fs`).
const opencvDestDir = join(publicRoot, "assets/opencv");
mkdirSync(opencvDestDir, { recursive: true });
const opencvRequirePaths = [
  join(root, "packages/core"),
  root,
];
let opencvStaged = false;
for (const from of opencvRequirePaths) {
  try {
    const localRequire = createRequire(join(from, "package.json"));
    const opencvEntry = localRequire.resolve("@techstark/opencv-js");
    const opencvJs = join(dirname(opencvEntry), "opencv.js");
    const opencvSource = existsSync(opencvJs) ? opencvJs : opencvEntry;
    const opencvDest = join(opencvDestDir, "opencv.js");
    cpSync(opencvSource, opencvDest);
    console.log(
      `Staged OpenCV.js → ${opencvDest} (${statSync(opencvDest).size} bytes)`,
    );
    opencvStaged = true;
    break;
  } catch {
    // try next path
  }
}
if (!opencvStaged) {
  console.warn(
    "⚠ @techstark/opencv-js not found — ROI cascade will soft-skip until it is installed/staged.",
  );
}

console.log(
  "Reminder: AGPL Ultralytics weights are for local playground testing only.",
);
