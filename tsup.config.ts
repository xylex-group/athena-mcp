import { defineConfig } from "tsup";

export default defineConfig({
  external: ["@xylex-group/athena"],
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
  splitting: false,
  dts: false,
  outExtension() {
    return { js: ".js" };
  },
});
