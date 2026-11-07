import { BarcodeError } from "../errors/BarcodeError.js";
import { assertSupportedFormats, DEFAULT_FORMATS } from "../decoder/formats.js";
import type { BarcodeScannerOptions } from "../types/scanner.types.js";
import type { BarcodeFormat } from "../types/barcode.types.js";

export interface ResolvedScannerOptions {
  formats: BarcodeFormat[];
  camera: BarcodeScannerOptions["camera"];
  detection: {
    multiple: boolean;
    maxResults: number;
    maxRegions: number;
    maxDepth: number;
    overlap: number;
    maxTimeMs: number;
  };
  performance: {
    scanInterval: number;
    maxWidth: number;
    maxHeight: number;
    useWorker: boolean;
  };
  duplicateFilter: {
    enabled: boolean;
    cooldown: number;
  };
}

function assertPositiveNumber(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new BarcodeError("SCAN_FAILED", `Invalid option "${name}": expected a non-negative number.`);
  }
}

export function resolveOptions(options: BarcodeScannerOptions = {}): ResolvedScannerOptions {
  const formats = options.formats?.length ? [...options.formats] : [...DEFAULT_FORMATS];
  assertSupportedFormats(formats);

  assertPositiveNumber("camera.width", options.camera?.width);
  assertPositiveNumber("camera.height", options.camera?.height);
  assertPositiveNumber("camera.frameRate", options.camera?.frameRate);
  assertPositiveNumber("detection.maxResults", options.detection?.maxResults);
  assertPositiveNumber("detection.maxRegions", options.detection?.maxRegions);
  assertPositiveNumber("detection.maxDepth", options.detection?.maxDepth);
  assertPositiveNumber("detection.overlap", options.detection?.overlap);
  assertPositiveNumber("detection.maxTimeMs", options.detection?.maxTimeMs);
  assertPositiveNumber("performance.scanInterval", options.performance?.scanInterval);
  assertPositiveNumber("performance.maxWidth", options.performance?.maxWidth);
  assertPositiveNumber("performance.maxHeight", options.performance?.maxHeight);
  assertPositiveNumber("duplicateFilter.cooldown", options.duplicateFilter?.cooldown);

  if (
    options.detection?.overlap !== undefined &&
    (options.detection.overlap < 0 || options.detection.overlap >= 1)
  ) {
    throw new BarcodeError(
      "SCAN_FAILED",
      'Invalid option "detection.overlap": expected a value in [0, 1).',
    );
  }

  return {
    formats,
    camera: options.camera,
    detection: {
      multiple: options.detection?.multiple ?? false,
      maxResults: options.detection?.maxResults ?? 10,
      maxRegions: options.detection?.maxRegions ?? 24,
      maxDepth: options.detection?.maxDepth ?? 3,
      overlap: options.detection?.overlap ?? 0.2,
      maxTimeMs: options.detection?.maxTimeMs ?? 400,
    },
    performance: {
      scanInterval: options.performance?.scanInterval ?? 100,
      maxWidth: options.performance?.maxWidth ?? 1280,
      maxHeight: options.performance?.maxHeight ?? 720,
      // Deferred — Phase 2 always main-thread.
      useWorker: false,
    },
    duplicateFilter: {
      enabled: options.duplicateFilter?.enabled ?? true,
      cooldown: options.duplicateFilter?.cooldown ?? 1500,
    },
  };
}
