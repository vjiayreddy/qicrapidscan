<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { BarcodeScanner, type BarcodeResult } from "@qicrapidscan/core";

const video = ref<HTMLVideoElement | null>(null);
const results = ref<BarcodeResult[]>([]);
const error = ref<string | null>(null);

const scanner = new BarcodeScanner({
  formats: ["QR_CODE", "EAN_13", "CODE_128"],
  detection: { multiple: true },
});

scanner.on("result", (next) => {
  results.value = [...next, ...results.value].slice(0, 10);
});
scanner.on("error", (err) => {
  error.value = err.message;
});

async function start() {
  if (!video.value) return;
  error.value = null;
  await scanner.start(video.value);
}

async function stop() {
  await scanner.stop();
}

onMounted(() => {
  // Manual start — mirrors camera permission UX.
});

onBeforeUnmount(() => {
  void scanner.destroy();
});
</script>

<template>
  <div style="font-family: sans-serif; max-width: 640px; margin: 24px auto">
    <h1>Vue example</h1>
    <video ref="video" muted playsinline style="width: 100%; background: #111" />
    <div style="margin-top: 8px; display: flex; gap: 8px">
      <button type="button" @click="start">Start</button>
      <button type="button" @click="stop">Stop</button>
    </div>
    <p v-if="error" style="color: #b00020">{{ error }}</p>
    <ul>
      <li v-for="(item, index) in results" :key="index">
        {{ item.format }}: {{ item.text }}
      </li>
    </ul>
  </div>
</template>
