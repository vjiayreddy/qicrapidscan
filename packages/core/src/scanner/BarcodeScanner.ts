import { CameraManager } from "../camera/CameraManager.js";
import type { DecoderAdapter } from "../decoder/DecoderAdapter.js";
import { BarcodeError } from "../errors/BarcodeError.js";
import { EventEmitter } from "../events/EventEmitter.js";
import { DuplicateFilter } from "../processing/DuplicateFilter.js";
import { FrameProcessor } from "../processing/FrameProcessor.js";
import { ImageScanner, type ImageSource } from "../processing/ImageScanner.js";
import { drawVideoFrame } from "../processing/canvas.js";
import type { BarcodeResult } from "../types/barcode.types.js";
import type { CameraDevice } from "../types/camera.types.js";
import type { BarcodeScannerOptions } from "../types/scanner.types.js";
import { resolveOptions, type ResolvedScannerOptions } from "./validateOptions.js";

type ScannerEvents = {
  result: BarcodeResult[];
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
  private readonly injectedDecoder?: DecoderAdapter;
  private readonly injectedCamera?: CameraManager;

  private decoder: DecoderAdapter | null = null;
  private camera: CameraManager | null = null;
  private imageScanner: ImageScanner | null = null;
  private video: HTMLVideoElement | null = null;
  private runtimeReady: Promise<void> | null = null;
  private destroyed = false;
  private scanning = false;
  private paused = false;

  constructor(options: BarcodeScannerOptions = {}, deps: BarcodeScannerDependencies = {}) {
    this.rawOptions = options;
    this.resolved = resolveOptions(options);
    this.injectedDecoder = deps.decoder;
    this.injectedCamera = deps.camera;
    this.duplicateFilter = new DuplicateFilter(
      this.resolved.duplicateFilter.enabled,
      this.resolved.duplicateFilter.cooldown,
    );
    this.frameProcessor = new FrameProcessor(this.resolved.performance.scanInterval);
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
      const results = await this.imageScanner!.scan(source);
      if (results.length > 0) {
        this.events.emit("result", results);
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
  on(event: "error", callback: (error: BarcodeError) => void): () => void;
  on(
    event: "result" | "error",
    callback: ((results: BarcodeResult[]) => void) | ((error: BarcodeError) => void),
  ): () => void {
    this.assertAlive();
    if (event === "result") {
      return this.events.on("result", callback as (results: BarcodeResult[]) => void);
    }
    return this.events.on("error", callback as (error: BarcodeError) => void);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;
    await this.stopInternal(true);
    this.events.clear();
    this.duplicateFilter.clear();
    this.decoder?.destroy();
    this.decoder = null;
    this.camera = null;
    this.imageScanner = null;
    this.runtimeReady = null;
    this.destroyed = true;
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
        this.decoder = createDefaultDecoder(this.resolved.formats);
      }
      this.decoder.setFormats(this.resolved.formats);
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
    };
  }

  private async processLiveFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.scanning || this.paused || !this.decoder) return;

    let sized: ReturnType<typeof drawVideoFrame> | null = null;
    try {
      sized = drawVideoFrame(
        video,
        this.resolved.performance.maxWidth,
        this.resolved.performance.maxHeight,
      );

      let results: BarcodeResult[] = [];
      if (this.resolved.detection.multiple) {
        const { MultiBarcodeDetector } = await import(
          "../detection/MultiBarcodeDetector.js"
        );
        const detector = new MultiBarcodeDetector(this.decoder, {
          maxResults: this.resolved.detection.maxResults,
          maxRegions: this.resolved.detection.maxRegions,
          maxDepth: this.resolved.detection.maxDepth,
          overlap: this.resolved.detection.overlap,
          maxTimeMs: this.resolved.detection.maxTimeMs,
        });
        results = detector.detect(sized.canvas).results;
      } else {
        const decoded = this.decoder.decode({
          canvas: sized.canvas,
          sourceWidth: sized.sourceWidth,
          sourceHeight: sized.sourceHeight,
        });
        if (decoded) results = [decoded];
      }

      if (results.length === 0) return;
      const accepted = this.duplicateFilter.filter(results);
      if (accepted.length > 0) {
        this.events.emit("result", accepted);
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
    }
  }

  private async stopInternal(clearDuplicates: boolean): Promise<void> {
    this.frameProcessor.stop();
    this.scanning = false;
    this.paused = false;
    this.video = null;
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
