import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolveVisualEvidenceSlugs } from "./select.mjs";
const config = JSON.parse(
  await readFile(
    new URL("../../visual-evidence.config.json", import.meta.url),
    "utf8",
  ),
);
const slugs = resolveVisualEvidenceSlugs(
  process.env.VISUAL_EVIDENCE_SLUGS,
  config,
);
for (const cloudflare of [false, true]) {
  const selected = slugs.filter(
    (slug) => slug.startsWith("cloudflare-widget-") === cloudflare,
  );
  if (!selected.length) continue;
  const args = cloudflare
    ? [
        "exec",
        "playwright",
        "test",
        "--config",
        "playwright.cloudflare.config.ts",
        "--grep",
        "captures ",
      ]
    : [
        "exec",
        "playwright",
        "test",
        "e2e/visual-evidence.spec.ts",
        "--project",
        "desktop-chromium",
        "--project",
        "mobile-chromium",
      ];
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    env: { ...process.env, VISUAL_EVIDENCE_SLUGS: selected.join(",") },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
