#!/usr/bin/env node
/**
 * Generate a labeled multi-barcode PNG corpus for Phase 3 metrics.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import QRCode from "qrcode";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "packages/testing/fixtures/multi");

async function qrPng(text, size = 96) {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

function decodePng(buffer) {
  return PNG.sync.read(buffer);
}

function blit(dest, src, dx, dy) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= dest.width || ty >= dest.height) continue;
      const si = (y * src.width + x) << 2;
      const di = (ty * dest.width + tx) << 2;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = 255;
    }
  }
}

function makeBlank(width, height, fill = 255) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = fill;
    png.data[i + 1] = fill;
    png.data[i + 2] = fill;
    png.data[i + 3] = 255;
  }
  return png;
}

async function composeGrid(labels, cols, cell = 120, pad = 16) {
  const rows = Math.ceil(labels.length / cols);
  const width = cols * cell + pad * 2;
  const height = rows * cell + pad * 2;
  const canvas = makeBlank(width, height);
  const groundTruth = [];

  for (let i = 0; i < labels.length; i += 1) {
    const text = labels[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * cell + Math.floor((cell - 96) / 2);
    const y = pad + row * cell + Math.floor((cell - 96) / 2);
    const qr = decodePng(await qrPng(text, 96));
    blit(canvas, qr, x, y);
    groundTruth.push({
      text,
      format: "QR_CODE",
      boundingBox: { x, y, width: qr.width, height: qr.height },
    });
  }

  return { png: canvas, groundTruth };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cases = [
    { id: "multi-2", labels: ["QR-A-001", "QR-B-002"], cols: 2 },
    { id: "multi-4", labels: ["QR-A-001", "QR-B-002", "QR-C-003", "QR-D-004"], cols: 2 },
    {
      id: "multi-6",
      labels: ["QR-A-001", "QR-B-002", "QR-C-003", "QR-D-004", "QR-E-005", "QR-F-006"],
      cols: 3,
    },
    {
      id: "multi-9",
      labels: Array.from({ length: 9 }, (_, i) => `QR-N-${String(i + 1).padStart(3, "0")}`),
      cols: 3,
    },
  ];

  const manifest = [];

  for (const item of cases) {
    const { png, groundTruth } = await composeGrid(item.labels, item.cols);
    const file = `${item.id}.png`;
    writeFileSync(join(OUT, file), PNG.sync.write(png));
    writeFileSync(
      join(OUT, `${item.id}.json`),
      JSON.stringify(
        {
          id: item.id,
          image: file,
          groundTruth,
        },
        null,
        2,
      ),
    );
    manifest.push({ id: item.id, image: file, count: groundTruth.length });
    console.log(`wrote ${file} (${groundTruth.length} codes)`);
  }

  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ cases: manifest }, null, 2));
  console.log(`corpus ready at ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
