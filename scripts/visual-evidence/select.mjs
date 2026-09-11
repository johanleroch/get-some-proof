import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { validateTrustedConfig } from "./core.mjs";

const MARKER = /<!--\s*visual-evidence-screens:\s*([a-z0-9.,_\s-]+?)\s*-->/gi;

export function selectVisualEvidenceScreens(body, config) {
  const trustedConfig = validateTrustedConfig(config);
  const matches = [...String(body ?? "").matchAll(MARKER)];
  if (matches.length !== 1) {
    throw new Error(
      "The pull request body must contain exactly one <!-- visual-evidence-screens: ... --> marker",
    );
  }

  const requested = matches[0][1]
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    throw new Error("The visual evidence screen selection is empty");
  }
  if (requested.includes("none")) {
    if (requested.length !== 1) {
      throw new Error("none cannot be combined with visual evidence screens");
    }
    return [];
  }
  if (requested.includes("all")) {
    if (requested.length !== 1) {
      throw new Error("all cannot be combined with visual evidence screens");
    }
    return trustedConfig.screens.map((screen) => screen.slug);
  }

  const available = new Set(trustedConfig.screens.map((screen) => screen.slug));
  const selected = [...new Set(requested)];
  const unknown = selected.filter((slug) => !available.has(slug));
  if (unknown.length > 0) {
    throw new Error(`Unknown visual evidence screens: ${unknown.join(", ")}`);
  }
  return selected;
}

async function main() {
  const config = JSON.parse(
    await readFile(
      new URL("../../visual-evidence.config.json", import.meta.url),
      "utf8",
    ),
  );
  const selected = selectVisualEvidenceScreens(
    process.env.VISUAL_EVIDENCE_PR_BODY,
    config,
  );
  console.log(`slugs=${selected.join(",")}`);
  console.log(`has_screens=${selected.length > 0}`);
  console.log(
    `summary=${selected.length > 0 ? selected.join(", ") : "no visual change"}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
