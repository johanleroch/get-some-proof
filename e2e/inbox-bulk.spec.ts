import { expect, test } from "@playwright/test";

test("selects by keyboard, performs a contextual batch, and resets on tab change", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-inbox");
  const select = page.getByRole("checkbox", {
    name: "Select displayed testimonials",
  });
  await select.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  const rowCheckbox = page.getByRole("checkbox", {
    name: "Select Alice Martin's testimonial",
  });
  await rowCheckbox.uncheck();
  await expect(select).toHaveAttribute("aria-checked", "mixed");
  await rowCheckbox.check();
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect(page.getByText("3 archived.", { exact: true })).toBeVisible();
  await select.check();
  await page.getByRole("tab", { name: /^Published/ }).click();
  await expect(page.getByText(/ selected$/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("opens a single destructive confirmation and cancels without losing selection", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-inbox");
  await page
    .getByRole("checkbox", { name: "Select displayed testimonials" })
    .check();
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete permanently" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Permanently delete 3 testimonials?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
});
