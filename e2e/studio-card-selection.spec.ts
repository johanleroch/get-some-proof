import { expect, test } from "@playwright/test";

test("the full testimonial card toggles selection while video preview stays independent", async ({
  page,
}, testInfo) => {
  await page.goto("/kit/studio");
  const edit = page.getByRole("button", { name: "Edit widget", exact: true });
  if (await edit.isVisible()) await edit.click();
  await page
    .getByRole("button", { name: "Manage selection", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Manage testimonials" });
  const row = dialog
    .locator("[data-studio-testimonial]")
    .filter({ hasText: "Maya Laurent" });
  const checkbox = row.getByRole("checkbox", { name: "Select Maya Laurent" });
  await expect(checkbox).toBeChecked();
  await row.click({ position: { x: 130, y: 40 } });
  await expect(checkbox).not.toBeChecked();
  await row.click({ position: { x: 130, y: 40 } });
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  const video = dialog
    .locator("[data-studio-testimonial]")
    .filter({ hasText: "Remy Jupille" });
  await expect(video.getByRole("checkbox")).not.toBeChecked();
  await video
    .getByRole("button", { name: "Preview Remy Jupille's video" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Remy Jupille’s video", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(video.getByRole("checkbox")).not.toBeChecked();
  await video.click({ position: { x: 150, y: 40 } });
  await expect(video.getByRole("checkbox")).toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath("card-selection.png"),
    animations: "disabled",
    scale: "css",
  });
});
