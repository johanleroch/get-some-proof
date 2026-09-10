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
