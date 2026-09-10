import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Owner explicitly attests to reuse rights before enabling assistant imports", async ({
  page,
}) => {
  await page.goto("/visual-evidence/mcp-setup");
  const enable = page.getByRole("button", { name: "Enable assistant imports" });
  await expect(enable).toBeDisabled();
  await page.getByRole("checkbox").check();
  await enable.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Reuse rights confirmed" }),
  ).toContainText("Reuse rights confirmed");
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((node) => node.clientWidth),
  );
});

test("Free explains the import and offers an upgrade without activation", async ({
  page,
}) => {
  await page.goto("/visual-evidence/mcp-setup-free");
  await expect(
    page.getByRole("link", { name: "Upgrade to Pro" }),
  ).toHaveAttribute("href", "/account/billing");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enable assistant imports" }),
  ).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  for (const screen of [
    "mcp-setup-connected",
    "assistant-import-consent",
    "assistant-import-consent-free",
  ]) {
    test(`${screen} is accessible in ${theme}`, async ({ page }) => {
      await page.addInitScript(
        (theme) => localStorage.setItem("get-some-proof-theme", theme),
        theme,
      );
      await page.goto(`/visual-evidence/${screen}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body")).toHaveJSProperty(
        "scrollWidth",
        await page.locator("body").evaluate((node) => node.clientWidth),
      );
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations).toEqual([]);
      if (screen === "mcp-setup-connected") {
        await page.getByRole("tab", { name: "Codex" }).click();
        await expect(page.getByRole("tabpanel")).toContainText(
          "codex mcp login",
        );
        await page
          .getByRole("button", { name: "Disconnect Codex CLI" })
          .click();
        await expect(
          page.getByRole("button", { name: "Disconnect Codex CLI" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Disconnect Claude Code" }),
        ).toBeVisible();
      } else {
        const allow = page.getByRole("button", { name: "Allow connection" });
        await expect(allow).toBeDisabled();
        if (screen === "assistant-import-consent") {
          await page.getByRole("checkbox").check();
          await expect(allow).toBeEnabled();
          await allow.click();
          await expect(
            page.getByText("This request may have expired.", { exact: false }),
          ).toBeVisible();
        } else
          await expect(
            page.getByRole("link", { name: "Upgrade to Pro" }),
          ).toBeVisible();
      }
    });
  }
}
