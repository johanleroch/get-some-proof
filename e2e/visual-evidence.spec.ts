import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type VisualEvidenceConfig = {
  project: string;
  screens: Array<{
    slug: string;
    title: string;
    path: string;
    heading: string;
  }>;
};

const config = JSON.parse(
  await readFile(
    new URL("../visual-evidence.config.json", import.meta.url),
    "utf8",
  ),
) as VisualEvidenceConfig;

for (const screen of config.screens) {
  test(`captures ${screen.title}`, async ({ page }, testInfo) => {
    await page.goto(screen.path);
    await expect(
      page.getByRole("heading", { name: screen.heading }),
    ).toBeVisible();

    const outputRoot = path.resolve(
      process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
    );
    const projectDirectory = path.join(outputRoot, testInfo.project.name);
    await mkdir(projectDirectory, { recursive: true });

    await page.screenshot({
      path: path.join(projectDirectory, `${screen.slug}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    });
  });
}
