import { expect, test } from "@playwright/test";

test("Owner explicitly attests to reuse rights before enabling assistant imports", async ({
  page,
}) => {
  await page.goto("/visual-evidence/mcp-setup");
  const enable = page.getByRole("button", { name: "Enable assistant imports" });
  await expect(enable).toBeDisabled();
  await page.getByRole("checkbox").check();
  await enable.click();
  await expect(page.getByRole("status")).toContainText(
    "Reuse rights confirmed",
  );
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
