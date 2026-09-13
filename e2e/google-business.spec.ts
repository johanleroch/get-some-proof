import { expect, test } from "@playwright/test";

test("automatic updates require consent to replace the account notification destination", async ({
  page,
}) => {
  await page.goto("/visual-evidence/google-business");
  await page.getByRole("button", { name: "Enable automatic updates" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByText(/Another connected tool may stop receiving/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByText("Automatic updates enabled", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enable automatic updates" }).click();
  await dialog
    .getByRole("button", { name: "Enable automatic updates" })
    .click();
  await expect(
    page.getByText("Automatic updates enabled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Turn off here" }).click();
  await expect(
    page.getByRole("button", { name: "Enable automatic updates" }),
  ).toBeVisible();
});

test("Google reviews remain private and the connection can be removed", async ({
  page,
}) => {
  await page.goto("/visual-evidence/google-business");
  await expect(
    page.getByRole("heading", { name: "Google reviews" }),
  ).toBeVisible();
  await expect(page.getByText(/Reviews stay private here/)).toBeVisible();
  await expect(page.getByText("Camille Roche")).toBeVisible();
  await page.getByRole("button", { name: "Disconnect Google" }).click();
  await expect(page.getByText("Camille Roche")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect Google Business Profile" }),
  ).toBeVisible();
});
