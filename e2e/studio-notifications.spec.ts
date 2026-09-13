import { expect, test } from "@playwright/test";

test("publishing, saving and unpublishing report only through notifications", async ({
  page,
}, testInfo) => {
  await page.goto("/kit/studio");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "Published. Your embed is up to date.",
  );
  await expect(page.locator('[data-slot="studio-editor"]')).not.toContainText(
    "Published. Your embed is up to date.",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "Draft saved." }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="studio-editor"]')).not.toContainText(
    "Draft saved.",
  );
  await page.getByRole("button", { name: "Widget actions" }).click();
  await page.getByRole("menuitem", { name: "Unpublish widget" }).click();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Widget unpublished." }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="studio-editor"]')).not.toContainText(
    "Widget unpublished.",
  );
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("unpublished-toast.png") });
});
