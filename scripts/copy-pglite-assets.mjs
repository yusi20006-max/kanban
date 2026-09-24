import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "node_modules", "@electric-sql", "pglite", "dist");
const outputDir = join(root, ".vercel", "output", "functions", "__server.func", "_libs");
const assets = ["pglite.data", "pglite.wasm", "initdb.wasm"];

if (!existsSync(outputDir)) {
  throw new Error(`PGlite Nitro output directory not found: ${outputDir}`);
}

mkdirSync(outputDir, { recursive: true });

for (const asset of assets) {
  const source = join(sourceDir, asset);
  const target = join(outputDir, asset);
  if (!existsSync(source)) {
    throw new Error(`PGlite runtime asset not found: ${source}`);
  }
  copyFileSync(source, target);
  console.log(`[pglite-assets] copied ${asset}`);
}
