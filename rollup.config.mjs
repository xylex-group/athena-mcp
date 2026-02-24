import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.js",
    format: "cjs",
    sourcemap: true,
    banner: "#!/usr/bin/env node",
  },
  external: [
    "@modelcontextprotocol/sdk",
    "zod",
    "node:process",
    "node:path",
  ],
  plugins: [
    typescript(),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
  ],
};
