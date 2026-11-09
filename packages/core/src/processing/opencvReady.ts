/**
 * Lazy OpenCV.js loader. Soft-fails when unavailable.
 *
 * Loading order:
 * 1. Existing `globalThis.cv` (already initialized)
 * 2. Optional `scriptUrl` (staged playground asset — preferred for Next.js)
 * 3. Hidden dynamic import of `@techstark/opencv-js` (requires webpack
 *    `resolve.fallback.fs = false`; hidden so Next does not always analyze it)
 */

/** Minimal runtime surface used by the cascade. */
export type OpenCvRuntime = {
  Mat: {
    new (): {
      cols: number;
      rows: number;
      data: Uint8Array;
      type?: () => number;
      copyTo?: (dst: unknown) => void;
      delete: () => void;
    };
    new (
      rows: number,
      cols: number,
      type: number,
      scalar?: unknown,
    ): {
      cols: number;
      rows: number;
      data: Uint8Array;
      type?: () => number;
      copyTo?: (dst: unknown) => void;
      delete: () => void;
    };
    ones: (
      rows: number,
      cols: number,
      type: number,
    ) => {
      delete: () => void;
    };
  };
  Size: new (width: number, height: number) => unknown;
  Scalar: new (...args: number[]) => unknown;
  CLAHE: new (
    clipLimit?: number,
    tileGridSize?: unknown,
  ) => {
    apply: (src: unknown, dst: unknown) => void;
    delete: () => void;
  };
  imread: (el: HTMLCanvasElement | HTMLElement | string) => unknown;
  cvtColor: (...args: unknown[]) => void;
  resize: (...args: unknown[]) => void;
  copyMakeBorder: (...args: unknown[]) => void;
  GaussianBlur: (...args: unknown[]) => void;
  addWeighted: (...args: unknown[]) => void;
  adaptiveThreshold: (...args: unknown[]) => void;
  medianBlur: (...args: unknown[]) => void;
  threshold: (...args: unknown[]) => void;
  dilate: (...args: unknown[]) => void;
  erode: (...args: unknown[]) => void;
  COLOR_RGBA2GRAY: number;
  COLOR_GRAY2RGBA: number;
  INTER_CUBIC: number;
  BORDER_CONSTANT: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV?: number;
  THRESH_OTSU: number;
  CV_8U: number;
};

type OpenCvModuleLike = OpenCvRuntime & {
  onRuntimeInitialized?: (() => void) | null;
};

declare global {
  var cv: OpenCvModuleLike | undefined;
}

let opencvPromise: Promise<OpenCvRuntime | null> | null = null;
let preferredScriptUrl: string | undefined;

async function resolveOpenCvModule(
  cvModule: OpenCvModuleLike | Promise<OpenCvModuleLike>,
): Promise<OpenCvRuntime> {
  if (cvModule instanceof Promise) {
    return resolveOpenCvModule(await cvModule);
  }
  if (cvModule.Mat) {
    return cvModule;
  }
  await new Promise<void>((resolve) => {
    const previous = cvModule.onRuntimeInitialized;
    cvModule.onRuntimeInitialized = () => {
      if (typeof previous === "function") previous();
      resolve();
    };
  });
  return cvModule;
}

function loadOpenCvScript(url: string): Promise<OpenCvModuleLike> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("OpenCV script load requires document"));
      return;
    }
    if (globalThis.cv?.Mat) {
      void resolveOpenCvModule(globalThis.cv).then(resolve, reject);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-qic-opencv="1"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => {
        if (!globalThis.cv) {
          reject(new Error("OpenCV script loaded but global cv is missing"));
          return;
        }
        void resolveOpenCvModule(globalThis.cv).then(resolve, reject);
      });
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load OpenCV from ${url}`)),
      );
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.dataset.qicOpencv = "1";
    script.src = url;
    script.onload = () => {
      const cvModule = globalThis.cv;
      if (!cvModule) {
        reject(new Error("OpenCV script loaded but global cv is missing"));
        return;
      }
      void resolveOpenCvModule(cvModule).then(resolve, reject);
    };
    script.onerror = () => reject(new Error(`Failed to load OpenCV from ${url}`));
    document.head.appendChild(script);
  });
}

/** Hide the npm specifier from Webpack/Next static analysis (avoids `fs` build errors). */
async function importNpmOpenCv(): Promise<OpenCvModuleLike> {
  const dynImport = new Function(
    "m",
    "return import(m)",
  ) as (m: string) => Promise<{
    default?: OpenCvModuleLike | Promise<OpenCvModuleLike>;
  } & OpenCvModuleLike>;
  const mod = await dynImport("@techstark/opencv-js");
  return (mod.default ?? mod) as OpenCvModuleLike | Promise<OpenCvModuleLike>;
}

export interface EnsureOpenCvOptions {
  /** Optional URL to a staged opencv.js (e.g. `/assets/opencv/opencv.js`). */
  scriptUrl?: string;
}

/**
 * Load and initialize OpenCV.js once. Returns null when unavailable —
 * callers should skip the cascade.
 */
export function ensureOpenCv(
  options: EnsureOpenCvOptions = {},
): Promise<OpenCvRuntime | null> {
  if (options.scriptUrl) {
    preferredScriptUrl = options.scriptUrl;
  }

  if (!opencvPromise) {
    opencvPromise = (async () => {
      try {
        if (typeof globalThis !== "undefined" && globalThis.cv?.Mat) {
          return await resolveOpenCvModule(globalThis.cv);
        }

        const scriptUrl = preferredScriptUrl;
        if (scriptUrl) {
          const fromScript = await loadOpenCvScript(scriptUrl);
          globalThis.cv = fromScript;
          return fromScript;
        }

        const cvModule = await importNpmOpenCv();
        const ready = await resolveOpenCvModule(cvModule);
        if (typeof globalThis !== "undefined") {
          globalThis.cv = ready as OpenCvModuleLike;
        }
        return ready;
      } catch {
        return null;
      }
    })();
  }
  return opencvPromise;
}

/** Test helper — reset the singleton between cases. */
export function resetOpenCvForTests(): void {
  opencvPromise = null;
  preferredScriptUrl = undefined;
}
