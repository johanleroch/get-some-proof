import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

type VisualEvidenceConfig = {
  project: string;
  screens: Array<{
    slug: string;
    title: string;
    path: string;
    fixturePath?: string;
    heading: string;
    theme?: "light" | "dark";
    requiresAuth?: boolean;
    requiresBackend?: boolean;
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
    const fixtureMode = process.env.VISUAL_EVIDENCE_FIXTURES === "true";
    test.skip(
      Boolean(
        screen.requiresBackend &&
        !fixtureMode &&
        !process.env.NEXT_PUBLIC_CONVEX_URL,
      ),
      "A local Convex backend is required for this visual evidence screen.",
    );
    const configuredOrganizationSlug =
      process.env.VISUAL_EVIDENCE_ORGANIZATION_SLUG;
    const organizationSlug = fixtureMode
      ? (configuredOrganizationSlug ?? "visual-studio-l5pg")
      : configuredOrganizationSlug;
    if (screen.requiresAuth && !fixtureMode) {
      const email = process.env.VISUAL_EVIDENCE_EMAIL;
      const password = process.env.VISUAL_EVIDENCE_PASSWORD;
      test.skip(
        !email || !password,
        "Authenticated visual evidence credentials are not configured.",
      );

      await page.goto("/sign-in");
      await page.getByLabel("Email address").fill(email!);
      await page.getByLabel("Password").fill(password!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));

      test.skip(
        screen.path.includes(":organizationSlug") && !organizationSlug,
        "An Organization slug is required for this visual evidence screen.",
      );
    }

    if (screen.theme) {
      await page.addInitScript((theme) => {
        localStorage.setItem("get-some-proof-theme", theme);
      }, screen.theme);
    }
    const destination =
      fixtureMode && screen.fixturePath ? screen.fixturePath : screen.path;
    await page.goto(
      destination.replace(":organizationSlug", organizationSlug ?? ""),
    );
    await expect(
      page.getByRole("heading", { name: screen.heading, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(250);

    const outputRoot = path.resolve(
      process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
    );
    const projectDirectory = path.join(outputRoot, testInfo.project.name);
    await mkdir(projectDirectory, { recursive: true });

    await page.screenshot({
      path: path.join(projectDirectory, `${screen.slug}.png`),
      fullPage: true,
      animations: "disabled",
      caret: "initial",
      scale: "css",
    });
  });
}
