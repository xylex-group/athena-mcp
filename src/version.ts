/** @see https://nodejs.org/api/modules.html#__dirname - available in CJS output */
declare const __dirname: string;

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function getVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
