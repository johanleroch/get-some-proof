import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`assistant recovery distinguishes copied, missing and processing media in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("get-some-proof-theme", theme),
      theme,
    );
    await page.goto("/visual-evidence/assistant-import-recovery");
    const region = page.getByRole("region", {
      name: "Assistant import progress",
    });
    await expect(region).toBeVisible();
    await expect(region).toContainText("Video copied and checked.");
    await expect(region).toContainText("It is not Ready yet.");
    await expect(region).toContainText("Choose the original file");
    await expect(
      region.getByRole("link", { name: "Open source page" }),
    ).toHaveAttribute("href", "https://willow-ceramics.example/stories");
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((node) => node.clientWidth),
    );
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations).toEqual([]);
    for (const button of await region
      .getByRole("button", { name: "Choose video file" })
      .all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(
        testInfo.project.name.startsWith("mobile") ? 40 : 36,
      );
    }
  });
}

test("Owner selects a failed source video without restarting Ready media", async ({
  page,
}) => {
  await page.goto("/visual-evidence/assistant-import-recovery");
  const resume = page.getByRole("button", { name: "Resume selected videos" });
  await expect(resume).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Select video by Remy Jupille" }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Select video by Nora Lewis" })
    .check();
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(
    page.getByRole("checkbox", { name: "Select video by Nora Lewis" }),
  ).toHaveCount(0);
  const readyRow = page
    .getByRole("listitem")
    .filter({ hasText: "Remy Jupille" });
  await expect(readyRow).toContainText("Video copied and checked.");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Nora Lewis" }),
  ).toContainText("Processing");
});

test("a failed photo can resume without replacing copied portraits", async ({
  page,
}) => {
  await page.goto("/visual-evidence/assistant-import-recovery");
  const row = page.getByRole("listitem").filter({ hasText: "Elise Martin" });
  await row.getByRole("button", { name: "Retry photo" }).click();
  await expect(row).toContainText("Photo copying in the background.");
  await expect(row.getByRole("button", { name: "Retry photo" })).toHaveCount(0);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Camille Roche" }),
  ).toContainText("Photo copied.");
});

test("recent import menu links back to its private Inbox progress", async ({
  page,
}) => {
  await page.goto("/visual-evidence/assistant-import-recovery");
  await page.getByRole("button", { name: "Recent assistant imports" }).click();
  const item = page.getByRole("menuitem");
  await expect(item).toHaveAttribute(
    "href",
    "/org/willow-ceramics/inbox?import=fixture-job",
  );
  await expect(item).toContainText("willow-ceramics.example");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Recent assistant imports" }),
  ).toBeFocused();
});
