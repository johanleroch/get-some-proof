// Exports the blob expression set to public/brand/blob/<name>.svg and the
// animated behaviours to public/brand/blob/animated/<name>.svg.
//
// Source of truth: src/lib/blob-expressions.ts (also rendered on /kit/blob).
// Usage: node scripts/app-icons/blob-set.mjs
// Node 22.6+ strips the TypeScript types of the imported module natively.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  animatedBlobSvg,
  blobAnimations,
} from "../../src/lib/blob-animations.ts";
import { blobExpressions, blobSvg } from "../../src/lib/blob-expressions.ts";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/brand/blob",
);

await mkdir(path.join(OUT_DIR, "animated"), { recursive: true });
for (const expression of blobExpressions) {
  const file = path.join(OUT_DIR, `${expression.name}.svg`);
  await writeFile(file, `${blobSvg(expression)}\n`, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
for (const animation of blobAnimations) {
  const file = path.join(OUT_DIR, "animated", `${animation.name}.svg`);
  await writeFile(file, `${animatedBlobSvg(animation)}\n`, "utf8");
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
