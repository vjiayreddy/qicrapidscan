import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import dts from "rollup-plugin-dts";

const external = ["@zxing/library"];

const sharedPlugins = [
  resolve({ browser: true, preferBuiltins: false }),
  commonjs(),
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: false,
    declarationMap: false,
  }),
];

/** @type {import('rollup').RollupOptions[]} */
const config = [
  // npm ESM + CJS (ZXing external)
  {
    input: "src/index.ts",
    external,
    output: [
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: "dist/index.cjs",
        format: "cjs",
        sourcemap: true,
        exports: "named",
        inlineDynamicImports: true,
      },
    ],
    plugins: sharedPlugins,
  },
  // CDN browser ESM (ZXing bundled)
  {
    input: "src/cdn.ts",
    output: {
      file: "dist/qicrapidscan.esm.js",
      format: "esm",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: sharedPlugins,
  },
  // CDN IIFE standalone (ZXing bundled, minified)
  {
    input: "src/cdn.ts",
    output: {
      file: "dist/qicrapidscan.min.js",
      format: "iife",
      name: "QicRapidScan",
      exports: "named",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [...sharedPlugins, terser({ format: { comments: false } })],
  },
  // Unminified IIFE for debugging CDN consumers
  {
    input: "src/cdn.ts",
    output: {
      file: "dist/qicrapidscan.js",
      format: "iife",
      name: "QicRapidScan",
      exports: "named",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: sharedPlugins,
  },
  // Types
  {
    input: "src/index.ts",
    external,
    output: {
      file: "dist/index.d.ts",
      format: "esm",
    },
    plugins: [dts()],
  },
];

export default config;
