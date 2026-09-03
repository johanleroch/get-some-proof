import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  listPngFiles,
  validateManifest,
  validateTrustedConfig,
} from "./core.mjs";

const outputRoot = path.resolve(
  process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
);
const config = validateTrustedConfig(
  JSON.parse(
    await readFile(
      new URL("../../visual-evidence.config.json", import.meta.url),
    ),
  ),
);
const targetNumber = Number(
  process.env.VISUAL_EVIDENCE_TARGET_NUMBER ?? process.env.PR_NUMBER,
);
const targetKind = process.env.VISUAL_EVIDENCE_TARGET_KIND ?? "pull";
const repository = process.env.GITHUB_REPOSITORY;
const headSha = process.env.VISUAL_EVIDENCE_HEAD_SHA ?? process.env.GITHUB_SHA;
const screenTitles = new Map(
  config.screens.map((screen) => [screen.slug, screen.title]),
);

const screenshots = (await listPngFiles(outputRoot)).map((filePath) => {
  const [viewport, fileName] = filePath.split("/");
  const slug = fileName.replace(/\.png$/, "");
  return {
    path: filePath,
    title: screenTitles.get(slug) ?? slug,
    viewport,
  };
});

const manifest = validateManifest(
  {
    schemaVersion: 1,
    repository,
    project: config.project,
    target: { kind: targetKind, number: targetNumber },
    headSha,
    runId: process.env.GITHUB_RUN_ID ?? null,
    screenshots,
  },
  repository,
  config.project,
);

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Prepared ${screenshots.length} visual evidence screenshots.`);
