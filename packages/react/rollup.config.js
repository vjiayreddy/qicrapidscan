import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

const external = ["react", "react-dom", "react/jsx-runtime", "@qicrapidscan/core"];

/** @type {import('rollup').RollupOptions[]} */
const config = [
  {
    input: "src/index.ts",
    external,
    output: [
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true,
        banner: '"use client";',
      },
      {
        file: "dist/index.cjs",
        format: "cjs",
        sourcemap: true,
        exports: "named",
        banner: '"use client";',
      },
    ],
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
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
