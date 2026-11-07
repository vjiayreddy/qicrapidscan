import { BarcodeScanner } from "@qicrapidscan/core";

const video = document.querySelector<HTMLVideoElement>("#preview")!;
const out = document.querySelector<HTMLPreElement>("#out")!;

const scanner = new BarcodeScanner({
  formats: ["QR_CODE", "EAN_13", "CODE_128"],
  detection: { multiple: true },
});

scanner.on("result", (results) => {
  out.textContent = results.map((r) => `${r.format}: ${r.text}`).join("\n");
});

scanner.on("error", (error) => {
  out.textContent = `Error: ${error.message}`;
});

document.querySelector("#start")?.addEventListener("click", () => {
  void scanner.start(video);
});

document.querySelector("#stop")?.addEventListener("click", () => {
  void scanner.stop();
});

window.addEventListener("beforeunload", () => {
  void scanner.destroy();
});
