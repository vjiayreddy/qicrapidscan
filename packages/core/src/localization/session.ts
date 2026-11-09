export interface OrtLike {
  env: {
    wasm: {
      numThreads: number;
      wasmPaths: string;
      proxy?: boolean;
    };
  };
  Tensor: new (
    type: "float32",
    data: Float32Array,
    dims: number[],
  ) => unknown;
  InferenceSession: {
    create: (
      model: string,
      options?: {
        executionProviders?: string[];
        graphOptimizationLevel?: string;
      },
    ) => Promise<OrtInferenceSession>;
  };
}

export interface OrtInferenceSession {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
  release?: () => void | Promise<void>;
}

export interface OrtTensor {
  data: ArrayLike<number | bigint | string>;
  dims: readonly number[];
}

export interface OrtSessionHandle {
  ort: OrtLike;
  session: OrtInferenceSession;
  loadMs: number;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

/**
 * `new URL(file, "/path/")` needs an absolute base in some environments.
 * Accepts absolute http(s), path-absolute (`/foo`), or relative.
 */
export function toAbsoluteUrl(urlOrPath: string): string {
  const value = urlOrPath.trim();
  if (!value) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value;
  }
  const origin =
    typeof self !== "undefined" && "location" in self && self.location?.origin
      ? self.location.origin
      : typeof location !== "undefined" && location?.origin
        ? location.origin
        : "http://localhost";
  if (value.startsWith("/")) {
    return `${origin}${value}`;
  }
  return new URL(value, `${origin}/`).href;
}

export function toFloat32(
  data: ArrayLike<number | bigint | string>,
): Float32Array {
  if (data instanceof Float32Array) return data;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = Number(data[i]);
  }
  return out;
}

const ortLoadCache = new Map<string, Promise<OrtLike>>();

/**
 * Load an ES module from an absolute URL without bundler rewriting.
 * Prefer `new Function` so Next/webpack cannot transform the dynamic import
 * into a local chunk lookup (that was causing localizer_unavailable).
 */
async function importFromUrl(url: string): Promise<OrtLike> {
  const dynamicImport = new Function(
    "u",
    "return import(u)",
  ) as (u: string) => Promise<{ default?: OrtLike } & OrtLike>;

  try {
    const mod = await dynamicImport(url);
    return (mod.default ?? mod) as OrtLike;
  } catch (primary) {
    try {
      const mod = (await import(
        /* webpackIgnore: true */
        /* @vite-ignore */
        url
      )) as { default?: OrtLike } & OrtLike;
      return (mod.default ?? mod) as OrtLike;
    } catch {
      throw primary;
    }
  }
}

async function loadOrt(ortWasmBaseUrl: string): Promise<OrtLike> {
  const base = ensureTrailingSlash(toAbsoluteUrl(ortWasmBaseUrl));
  const cached = ortLoadCache.get(base);
  if (cached) return cached;

  const pending = (async () => {
    const candidates = ["ort.wasm.min.mjs", "ort.min.mjs", "ort.wasm.mjs"];
    let lastError: unknown;
    for (const file of candidates) {
      try {
        const url = new URL(file, base).href;
        const ort = await importFromUrl(url);
        if (!ort?.env?.wasm || !ort.InferenceSession) {
          throw new Error(
            `ORT module from ${url} is missing env/InferenceSession.`,
          );
        }
        const wasmEnv = ort.env.wasm as {
          numThreads: number;
          wasmPaths: string;
          proxy?: boolean;
        };
        wasmEnv.proxy = false;
        return ort;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `Failed to load onnxruntime-web from ${base}: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  })();

  ortLoadCache.set(base, pending);
  try {
    return await pending;
  } catch (error) {
    ortLoadCache.delete(base);
    throw error;
  }
}

export async function createOrtSession(
  modelUrl: string,
  ortWasmBaseUrl: string,
): Promise<OrtSessionHandle> {
  const absoluteModel = toAbsoluteUrl(modelUrl);
  const absoluteOrt = ensureTrailingSlash(toAbsoluteUrl(ortWasmBaseUrl));
  const ort = await loadOrt(absoluteOrt);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = absoluteOrt;

  const t0 = performance.now();
  const session = await ort.InferenceSession.create(absoluteModel, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  return { ort, session, loadMs: performance.now() - t0 };
}

export async function runYoloInference(
  ort: OrtLike,
  session: OrtInferenceSession,
  inputNchw: Float32Array,
  inputSize: number,
): Promise<{ data: Float32Array; dims: readonly number[]; inferMs: number }> {
  const inputName = session.inputNames[0] ?? "images";
  const feeds: Record<string, unknown> = {
    [inputName]: new ort.Tensor("float32", inputNchw, [
      1,
      3,
      inputSize,
      inputSize,
    ]),
  };

  const t0 = performance.now();
  const results = await session.run(feeds);
  const inferMs = performance.now() - t0;

  const outputName = session.outputNames[0] ?? "output0";
  const tensor = results[outputName];
  if (!tensor) {
    throw new Error(
      `Missing YOLO output "${outputName}". Got: ${session.outputNames.join(", ")}`,
    );
  }

  return {
    data: toFloat32(tensor.data),
    dims: tensor.dims,
    inferMs,
  };
}
