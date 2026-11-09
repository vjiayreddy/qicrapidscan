import {
  DEFAULT_CLASS_NAME,
  DEFAULT_INPUT_SIZE,
  DEFAULT_IOU_THRESHOLD,
  DEFAULT_SCORE_THRESHOLD,
} from "./constants.js";
import { letterboxImageData } from "./letterbox.js";
import {
  createOrtSession,
  runYoloInference,
  type OrtInferenceSession,
  type OrtLike,
} from "./session.js";
import {
  candidatesToRois,
  decodeYoloOutput,
  nms,
} from "./yoloDecode.js";
import type {
  LocateInput,
  LocateResult,
  OnnxBarcodeLocalizer,
  OnnxLocalizerInitOptions,
} from "./types.js";

class OnnxBarcodeLocalizerImpl implements OnnxBarcodeLocalizer {
  readonly backend = "onnx" as const;
  private ort: OrtLike | null = null;
  private session: OrtInferenceSession | null = null;
  private options: OnnxLocalizerInitOptions | null = null;
  private initFailedReason: string | null = null;

  get ready(): boolean {
    return this.session !== null;
  }

  async initialize(options: OnnxLocalizerInitOptions): Promise<void> {
    if (!options.modelUrl?.trim()) {
      throw new Error("ONNX localizer requires modelUrl.");
    }
    if (!options.ortWasmBaseUrl?.trim()) {
      throw new Error("ONNX localizer requires ortWasmBaseUrl.");
    }

    await this.destroySession();
    this.initFailedReason = null;
    this.options = {
      ...options,
      scoreThreshold: options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD,
      iouThreshold: options.iouThreshold ?? DEFAULT_IOU_THRESHOLD,
      inputSize: options.inputSize ?? DEFAULT_INPUT_SIZE,
      className: options.className ?? DEFAULT_CLASS_NAME,
    };

    try {
      const handle = await createOrtSession(
        this.options.modelUrl,
        this.options.ortWasmBaseUrl,
      );
      this.ort = handle.ort;
      this.session = handle.session;
    } catch (error) {
      this.initFailedReason =
        error instanceof Error ? error.message : String(error);
      this.ort = null;
      this.session = null;
      throw error;
    }
  }

  async locate(input: LocateInput): Promise<LocateResult> {
    const started = performance.now();
    const { imageData, maxRois = 64 } = input;

    if (!this.session || !this.ort || !this.options) {
      return {
        rois: [
          {
            x: 0,
            y: 0,
            width: imageData.width,
            height: imageData.height,
            label: "passthrough",
          },
        ],
        backend: "passthrough",
        elapsedMs: performance.now() - started,
        usedFallback: true,
        fallbackReason: this.initFailedReason ?? "localizer_not_ready",
      };
    }

    const inputSize = this.options.inputSize ?? DEFAULT_INPUT_SIZE;
    const { tensor, meta } = letterboxImageData(imageData, inputSize);
    const output = await runYoloInference(
      this.ort,
      this.session,
      tensor,
      inputSize,
    );

    const candidates = decodeYoloOutput(
      output.data,
      output.dims,
      this.options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD,
    );
    const kept = nms(
      candidates,
      this.options.iouThreshold ?? DEFAULT_IOU_THRESHOLD,
      Math.max(1, maxRois),
    );
    const rois = candidatesToRois(
      kept,
      meta,
      this.options.className ?? DEFAULT_CLASS_NAME,
    );

    return {
      rois,
      backend: "onnx",
      elapsedMs: performance.now() - started,
      usedFallback: false,
    };
  }

  async destroy(): Promise<void> {
    await this.destroySession();
    this.options = null;
    this.initFailedReason = null;
  }

  private async destroySession(): Promise<void> {
    if (this.session?.release) {
      try {
        await this.session.release();
      } catch {
        // ignore release errors
      }
    }
    this.session = null;
    this.ort = null;
  }
}

export function createOnnxLocalizer(): OnnxBarcodeLocalizer {
  return new OnnxBarcodeLocalizerImpl();
}
