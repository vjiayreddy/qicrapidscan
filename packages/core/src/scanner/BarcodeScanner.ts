import { CameraManager } from "../camera/CameraManager.js";
import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { selectLiveFormatBand } from "../decoder/liveFormatBand.js";
import {
  ResultTracker,
  toTrackedDecode,
} from "../detection/ResultTracker.js";
import { scaleResultsToSource } from "../detection/geometry.js";
import { MultiBarcodeDetector } from "../detection/MultiBarcodeDetector.js";
import { BarcodeError } from "../errors/BarcodeError.js";
import { EventEmitter } from "../events/EventEmitter.js";
import { DuplicateFilter } from "../processing/DuplicateFilter.js";
import {
  createCenterZoomCanvas,
  mapResultsFromCenterZoom,
} from "../processing/centerZoom.js";
import { cropBarcodeFrame } from "../processing/cropBarcode.js";
import { decodeWithFallbacks } from "../processing/decodePipeline.js";
import { FrameProcessor } from "../processing/FrameProcessor.js";
import { ImageScanner, type ImageSource } from "../processing/ImageScanner.js";
import { drawVideoFrame } from "../processing/canvas.js";
import { createOnnxLocalizer } from "../localization/localizer.js";
import type {
  ImageLocalization,
  OnnxBarcodeLocalizer,
} from "../localization/types.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import type { CameraDevice } from "../types/camera.types.js";
import type { BarcodeScannerOptions } from "../types/scanner.types.js";
import { resolveOptions, type ResolvedScannerOptions } from "./validateOptions.js";

type ScannerEvents = {
  result: BarcodeResult[];
  /** Continuous AR overlay polygons for the live camera (may be empty to clear). */
  overlay: BarcodeResult[];
  error: BarcodeError;
};

export interface BarcodeScannerDependencies {
  decoder?: DecoderAdapter;
  camera?: CameraManager;
}

/**
 * Framework-independent barcode scanner.
 * Lazy-creates browser/ZXing resources on first start/scanImage — safe to import on the server.
 */
export class BarcodeScanner {
  private readonly rawOptions: BarcodeScannerOptions;
  private readonly resolved: ResolvedScannerOptions;
  private readonly events = new EventEmitter<ScannerEvents>();
  private readonly duplicateFilter: DuplicateFilter;
  private readonly frameProcessor: FrameProcessor;
  private readonly tracker: ResultTracker;
  private readonly injectedDecoder?: DecoderAdapter;
  private readonly injectedCamera?: CameraManager;

  private decoder: DecoderAdapter | null = null;
  private camera: CameraManager | null = null;
  private imageScanner: ImageScanner | null = null;
  private multiDetector: MultiBarcodeDetector | null = null;
  private localizer: OnnxBarcodeLocalizer | null = null;
  private localizerInit: Promise<boolean> | null = null;
  private localizerInitError: string | null = null;
  private lastImageLocalization: ImageLocalization | null = null;
  private video: HTMLVideoElement | null = null;
  private runtimeReady: Promise<void> | null = null;
  private destroyed = false;
  private scanning = false;
  private paused = false;
  private lastOverlayCount = 0;
  private liveFormatCursor = 0;

  constructor(options: BarcodeScannerOptions = {}, deps: BarcodeScannerDependencies = {}) {
    this.rawOptions = options;
    this.resolved = resolveOptions(options);
    this.injectedDecoder = deps.decoder;
    this.injectedCamera = deps.camera;
    this.duplicateFilter = new DuplicateFilter(
      this.resolved.duplicateFilter.enabled,
      this.resolved.duplicateFilter.cooldown,
      this.resolved.duplicateFilter.mode,
    );
    this.frameProcessor = new FrameProcessor(this.resolved.performance.scanInterval);
    this.tracker = new ResultTracker({
      dedupeWindowMs:
        this.resolved.duplicateFilter.mode === "once"
          ? Number.POSITIVE_INFINITY
          : this.resolved.duplicateFilter.cooldown,
      confirmHits: 1,
      missFrames: 6,
      smooth: 0.28,
    });
  }

  /** Mark format:text values as already scanned (survives remount seeding). */
  seedSeen(keys: Iterable<string>): void {
    this.duplicateFilter.seed(keys);
  }

  getOptions(): Readonly<BarcodeScannerOptions> {
    return this.rawOptions;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    this.assertAlive();
    if (typeof HTMLVideoElement !== "undefined" && !(video instanceof HTMLVideoElement)) {
      throw new BarcodeError("CAMERA_START_FAILED", "start() requires an HTMLVideoElement.");
    }

    await this.stopInternal(false);
    await this.ensureRuntime();

    try {
      await this.camera!.start(video);
      this.video = video;
      this.scanning = true;
      this.paused = false;
      this.tracker.reset();
      this.lastOverlayCount = 0;
      this.frameProcessor.start(video, () => this.processLiveFrame(video));
    } catch (error) {
      this.video = null;
      const mapped =
        error instanceof BarcodeError
          ? error
          : new BarcodeError(
              "CAMERA_START_FAILED",
              error instanceof Error ? error.message : "Failed to start scanner.",
            );
      this.events.emit("error", mapped);
      throw mapped;
    }
  }

  async stop(): Promise<void> {
    this.assertAlive();
    await this.stopInternal(true);
  }

  pause(): void {
    this.assertAlive();
    if (!this.scanning) return;
    this.paused = true;
    this.frameProcessor.pause();
  }

  resume(): void {
    this.assertAlive();
    if (!this.scanning || !this.paused) return;
    this.paused = false;
    this.frameProcessor.resume();
  }

  async scanImage(source: ImageSource): Promise<BarcodeResult[]> {
    this.assertAlive();
    await this.ensureRuntime();

    try {
      // Image scans always use the full configured format list (not live bands).
      this.decoder!.setFormats(this.resolved.formats);

      let results: BarcodeResult[];
      if (this.resolved.localization.enabled) {
        const ready = await this.ensureLocalizer();
        if (ready && this.localizer?.ready) {
          const outcome = await this.imageScanner!.scanHybrid(source, {
            localizer: this.localizer,
            roiPadding: this.resolved.localization.roiPadding,
            maxRois: this.resolved.localization.maxRois,
            openCvScriptUrl:
              this.resolved.localization.openCvScriptUrl || undefined,
          });
          this.lastImageLocalization = outcome.localization ?? null;
          results = outcome.results;
        } else {
          this.lastImageLocalization = {
            rois: [],
            backend: "none",
            elapsedMs: 0,
            usedFallback: true,
            fallbackReason:
              this.localizerInitError ?? "localizer_unavailable",
          };
          results = await this.imageScanner!.scan(source);
        }
      } else {
        this.lastImageLocalization = null;
        results = await this.imageScanner!.scan(source);
      }

      if (results.length > 0 && this.resolved.captureCrop) {
        results = await this.attachImageCrops(source, results);
      }
      if (results.length > 0) {
        this.events.emit("result", results);
        this.events.emit("overlay", results);
      }
      return results;
    } catch (error) {
      const mapped =
        error instanceof BarcodeError
          ? error
          : new BarcodeError(
              "SCAN_FAILED",
              error instanceof Error ? error.message : "Image scan failed.",
            );
      this.events.emit("error", mapped);
      throw mapped;
    }
  }

  /** Localization ROIs from the most recent hybrid `scanImage` (null if none). */
  getLastImageLocalization(): ImageLocalization | null {
    return this.lastImageLocalization;
  }

  /** Attach JPEG `cropDataUrl` thumbs from still-image geometry. */
  private async attachImageCrops(
    source: ImageSource,
    results: BarcodeResult[],
  ): Promise<BarcodeResult[]> {
    const cropSource = await resolveCropSource(source);
    if (!cropSource) return results;
    return results.map((item) => {
      // Cascade already attached the enhancement frame ZXing decoded.
      if (item.cropDataUrl) return item;
      const cropDataUrl = cropBarcodeFrame(cropSource, item, {
        // Sharp diagnostic thumb — cascade already handled quiet zone / enhance.
        maxEdge: 256,
        soften: false,
        contrast: 1.15,
      });
      return cropDataUrl ? { ...item, cropDataUrl } : item;
    });
  }

  async getCameras(): Promise<CameraDevice[]> {
    this.assertAlive();
    await this.ensureRuntime();
    return this.camera!.listDevices();
  }

  async switchCamera(deviceId: string): Promise<void> {
    this.assertAlive();
    if (!this.scanning || !this.camera || !this.video) {
      throw new BarcodeError(
        "CAMERA_START_FAILED",
        "switchCamera() requires an active scanning session. Call start() first.",
      );
    }

    this.frameProcessor.pause();
    try {
      await this.camera.switchCamera(deviceId);
      this.tracker.reset();
      this.lastOverlayCount = 0;
      if (!this.paused) {
        this.frameProcessor.start(this.video, () => this.processLiveFrame(this.video!));
      }
    } catch (error) {
      const mapped =
        error instanceof BarcodeError
          ? error
          : new BarcodeError(
              "CAMERA_START_FAILED",
              error instanceof Error ? error.message : "Failed to switch camera.",
            );
      this.events.emit("error", mapped);
      throw mapped;
    }
  }

  on(event: "result", callback: (results: BarcodeResult[]) => void): () => void;
  on(event: "overlay", callback: (results: BarcodeResult[]) => void): () => void;
  on(event: "error", callback: (error: BarcodeError) => void): () => void;
  on(
    event: "result" | "overlay" | "error",
    callback:
      | ((results: BarcodeResult[]) => void)
      | ((error: BarcodeError) => void),
  ): () => void {
    this.assertAlive();
    if (event === "result") {
      return this.events.on("result", callback as (results: BarcodeResult[]) => void);
    }
    if (event === "overlay") {
      return this.events.on("overlay", callback as (results: BarcodeResult[]) => void);
    }
    return this.events.on("error", callback as (error: BarcodeError) => void);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    await this.stopInternal(true);
    this.events.clear();
    this.duplicateFilter.clear();
    this.tracker.reset();
    this.decoder?.destroy();
    this.decoder = null;
    this.camera = null;
    this.imageScanner = null;
    this.multiDetector = null;
    if (this.localizer) {
      await this.localizer.destroy().catch(() => undefined);
      this.localizer = null;
    }
    this.localizerInit = null;
    this.localizerInitError = null;
    this.lastImageLocalization = null;
    this.runtimeReady = null;
    this.destroyed = true;
  }

  private ensureLocalizer(): Promise<boolean> {
    if (!this.resolved.localization.enabled) {
      return Promise.resolve(false);
    }
    if (this.localizer?.ready) {
      return Promise.resolve(true);
    }
    if (!this.localizerInit) {
      this.localizerInit = (async () => {
        try {
          const localizer = createOnnxLocalizer();
          await localizer.initialize({
            modelUrl: this.resolved.localization.modelUrl,
            ortWasmBaseUrl: this.resolved.localization.ortWasmBaseUrl,
            scoreThreshold: this.resolved.localization.scoreThreshold,
            iouThreshold: this.resolved.localization.iouThreshold,
            inputSize: this.resolved.localization.inputSize,
            className: this.resolved.localization.className,
          });
          this.localizer = localizer;
          this.localizerInitError = null;
          return true;
        } catch (error) {
          this.localizerInitError =
            error instanceof Error ? error.message : String(error);
          console.warn(
            "[qicrapidscan] ONNX localizer init failed; using decode-only.",
            error,
          );
          this.localizer = null;
          return false;
        }
      })();
    }
    return this.localizerInit;
  }

  private ensureRuntime(): Promise<void> {
    if (!this.runtimeReady) {
      this.runtimeReady = this.initRuntime();
    }
    return this.runtimeReady;
  }

  private async initRuntime(): Promise<void> {
    if (!this.decoder) {
      if (this.injectedDecoder) {
        this.decoder = this.injectedDecoder;
      } else {
        const { createDefaultDecoder } = await import("../decoder/ZXingDecoder.js");
        this.decoder = createDefaultDecoder(
          this.resolved.formats,
          this.resolved.performance.tryHarder,
          this.resolved.performance.alsoInverted,
        );
      }
      this.decoder.setFormats(this.resolved.formats);
      this.decoder.setTryHarder?.(this.resolved.performance.tryHarder);
      this.decoder.setAlsoInverted?.(this.resolved.performance.alsoInverted);
    }
    if (!this.camera) {
      this.camera = this.injectedCamera ?? new CameraManager();
      this.camera.setOptions(this.resolved.camera);
    }
    if (!this.imageScanner) {
      this.imageScanner = new ImageScanner(this.decoder, this.imageScannerOptions());
    } else {
      this.imageScanner.setOptions(this.imageScannerOptions());
    }
    if (this.resolved.detection.multiple) {
      this.multiDetector = new MultiBarcodeDetector(this.decoder, {
        maxResults: this.resolved.detection.maxResults,
        maxRegions: this.resolved.detection.maxRegions,
        maxDepth: this.resolved.detection.maxDepth,
        overlap: this.resolved.detection.overlap,
        maxTimeMs: this.resolved.detection.maxTimeMs,
      });
    }
  }

  private imageScannerOptions() {
    return {
      maxWidth: this.resolved.performance.maxWidth,
      maxHeight: this.resolved.performance.maxHeight,
      multiple: this.resolved.detection.multiple,
      multiLimits: {
        maxResults: this.resolved.detection.maxResults,
        maxRegions: this.resolved.detection.maxRegions,
        maxDepth: this.resolved.detection.maxDepth,
        overlap: this.resolved.detection.overlap,
        maxTimeMs: this.resolved.detection.maxTimeMs,
      },
      multiScale: this.resolved.performance.multiScale,
      rotationRetry: this.resolved.performance.rotationRetry,
      imageEnhancement: this.resolved.performance.imageEnhancement,
      tryHarder: this.resolved.performance.tryHarder,
      // Keep per-tile decode cheap so multi-detect can visit more regions
      // within maxTimeMs. Full-frame fallbacks still run after tiling.
      regionFallbacks: false,
      formats: this.resolved.formats,
    };
  }

  private async processLiveFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.scanning || this.paused || !this.decoder) return;

    let sized: ReturnType<typeof drawVideoFrame> | null = null;
    const started = performance.now();
    try {
      sized = drawVideoFrame(
        video,
        this.resolved.performance.maxWidth,
        this.resolved.performance.maxHeight,
      );

      // Cap per-frame symbology count so 1D / 1D+2D stay near 2D-only cost.
      if (this.resolved.performance.liveFormatBanding) {
        const band = selectLiveFormatBand(
          this.resolved.formats,
          this.liveFormatCursor,
        );
        this.liveFormatCursor = band.nextCursor;
        this.decoder.setFormats(band.formats);
      }

      let results: BarcodeResult[] = [];
      if (this.resolved.detection.multiple && this.multiDetector) {
        const multi = await this.multiDetector.detect(sized.canvas);
        results = scaleResultsToSource(
          multi.results,
          sized.canvas.width,
          sized.canvas.height,
          sized.sourceWidth,
          sized.sourceHeight,
        );
      } else {
        const decoded = await this.decoder.decode({
          canvas: sized.canvas,
          sourceWidth: sized.sourceWidth,
          sourceHeight: sized.sourceHeight,
        });
        if (decoded) results = [decoded];
      }

      // Far/small symbols often vanish after downscale — center crop + upscale.
      if (results.length === 0 && this.resolved.performance.liveZoom) {
        results = await this.decodeLiveZoom(
          sized.canvas,
          sized.sourceWidth,
          sized.sourceHeight,
        );
      }

      // Optional enhance-only pass on the zoom crop (no live rotation).
      if (
        results.length === 0 &&
        this.resolved.performance.liveZoom &&
        this.resolved.performance.imageEnhancement
      ) {
        results = await this.decodeLiveZoomEnhanced(
          sized.canvas,
          sized.sourceWidth,
          sized.sourceHeight,
        );
      }

      const tracked = results
        .map(toTrackedDecode)
        .filter((item): item is NonNullable<typeof item> => item != null);

      const tick = this.tracker.ingest(tracked);
      const shouldEmitOverlay =
        tick.overlay.length > 0 || this.lastOverlayCount > 0;

      if (shouldEmitOverlay) {
        this.lastOverlayCount = tick.overlay.length;
        this.events.emit("overlay", tick.overlay);
      }

      if (tick.accepted.length > 0) {
        // Keep DuplicateFilter as a secondary gate for result consumers.
        let accepted = this.duplicateFilter.filter(tick.accepted);
        if (accepted.length > 0 && this.resolved.captureCrop) {
          accepted = accepted.map((item) => {
            const cropDataUrl = cropBarcodeFrame(video, item);
            return cropDataUrl ? { ...item, cropDataUrl } : item;
          });
        }
        if (accepted.length > 0) {
          this.events.emit("result", accepted);
        }
      }
    } catch (error) {
      if (error instanceof BarcodeError) {
        this.events.emit("error", error);
        return;
      }
      this.events.emit(
        "error",
        new BarcodeError(
          "SCAN_FAILED",
          error instanceof Error ? error.message : "Live frame decode failed.",
        ),
      );
    } finally {
      sized?.cleanup();
      this.adaptLiveInterval(performance.now() - started);
      // Let the browser paint (laser / overlay) before the next decode.
      await yieldToMain();
    }
  }

  /**
   * Second-pass live decode: center crop + upscale so distant / small codes
   * still have enough module resolution after the full-frame downscale.
   */
  private async decodeLiveZoom(
    processingCanvas: HTMLCanvasElement,
    sourceWidth: number,
    sourceHeight: number,
  ): Promise<BarcodeResult[]> {
    if (!this.decoder) return [];

    const zoom = createCenterZoomCanvas(processingCanvas, {
      cropRatio: this.resolved.performance.liveZoomCropRatio,
      scale: this.resolved.performance.liveZoomScale,
    });
    const restoreTryHarder = this.resolved.performance.tryHarder;

    try {
      // Zoom pass always tries harder — blur/low-contrast far codes need it.
      this.decoder.setTryHarder?.(true);
      const decoded = await this.decoder.decode({ canvas: zoom.canvas });
      if (!decoded) return [];

      return scaleResultsToSource(
        mapResultsFromCenterZoom([decoded], zoom),
        processingCanvas.width,
        processingCanvas.height,
        sourceWidth,
        sourceHeight,
      );
    } finally {
      this.decoder.setTryHarder?.(restoreTryHarder);
      zoom.cleanup();
    }
  }

  /**
   * Third-pass live decode: enhance the zoom crop only (no rotation ladder).
   */
  private async decodeLiveZoomEnhanced(
    processingCanvas: HTMLCanvasElement,
    sourceWidth: number,
    sourceHeight: number,
  ): Promise<BarcodeResult[]> {
    if (!this.decoder) return [];

    const zoom = createCenterZoomCanvas(processingCanvas, {
      cropRatio: this.resolved.performance.liveZoomCropRatio,
      scale: this.resolved.performance.liveZoomScale,
    });

    try {
      const decoded = await decodeWithFallbacks(this.decoder, zoom.canvas, {
        tryDirect: false,
        enhancementOnly: true,
        imageEnhancement: true,
        forceTryHarderOnFallback: true,
        restoreTryHarder: this.resolved.performance.tryHarder,
      });
      if (!decoded) return [];

      return scaleResultsToSource(
        mapResultsFromCenterZoom([decoded], zoom),
        processingCanvas.width,
        processingCanvas.height,
        sourceWidth,
        sourceHeight,
      );
    } finally {
      zoom.cleanup();
    }
  }

  private adaptLiveInterval(decodeMs: number): void {
    const base = this.resolved.performance.scanInterval;
    // If a frame overran the budget, back off so the UI can catch up.
    const next =
      decodeMs > 45 ? Math.max(base, Math.ceil(decodeMs * 1.5)) : base;
    this.frameProcessor.setScanInterval(next);
  }

  private async stopInternal(clearDuplicates: boolean): Promise<void> {
    this.frameProcessor.stop();
    this.scanning = false;
    this.paused = false;
    this.video = null;
    this.liveFormatCursor = 0;
    this.frameProcessor.setScanInterval(this.resolved.performance.scanInterval);
    if (this.lastOverlayCount > 0) {
      this.lastOverlayCount = 0;
      this.events.emit("overlay", []);
    }
    this.tracker.reset();
    if (clearDuplicates) {
      this.duplicateFilter.clear();
    }
    if (this.camera) {
      await this.camera.stop();
    }
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new BarcodeError("SCANNER_DESTROYED", "Scanner has been destroyed.");
    }
  }
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function resolveCropSource(
  source: ImageSource,
): Promise<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null> {
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return source;
  }
  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    return source;
  }
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    return source;
  }
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    const url = URL.createObjectURL(source);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to decode crop source."));
        image.src = url;
      });
      return img;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return null;
}
