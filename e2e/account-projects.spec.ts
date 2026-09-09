import { expect, test } from "@playwright/test";

async function openProjectSelector(page: import("@playwright/test").Page) {
  const switcher = page.getByRole("button", { name: "Switch project" });
  if (!(await switcher.isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await switcher.click();
}

test("Free exposes shared credits and an upgrade path from project creation", async ({
  page,
}) => {
  await page.goto("/visual-evidence/dashboard");
  const usage = page.getByRole("region", { name: "Account plan and usage" });
  await expect(usage).toContainText("Free plan");
  await expect(usage).toContainText("1 / 1 active project");
  await expect(usage).toContainText("4 / 13 text credits used");
  await expect(
    usage.getByRole("link", { name: "Upgrade to Pro" }),
  ).toBeVisible();
  await openProjectSelector(page);
  await expect(
    page.getByRole("menuitem", { name: "Create project" }),
  ).toHaveAttribute("href", "/org/harbor-studio/billing");
});

test("Pro switches independent projects while keeping the Account plan and shared usage", async ({
  page,
}) => {
  await page.goto("/visual-evidence/account-pro");
  await openProjectSelector(page);
  await expect(
    page.getByRole("menuitem", { name: "Create project" }),
  ).toHaveAttribute("href", "/projects/new");
  await page.getByRole("menuitem", { name: "Northwind Coffee" }).click();
  // Close mobile navigation before checking the selected Project's content.
  const close = page.getByRole("button", { name: "Close", exact: true });
  if (await close.isVisible()) await close.click();
  await expect(
    page.getByRole("heading", { name: "Northwind Coffee", exact: true }),
  ).toBeVisible();
  const usage = page.getByRole("region", { name: "Account plan and usage" });
  await expect(usage).toContainText("Pro plan");
  await expect(usage).toContainText("8 / 25 videos stored");
  await expect(usage).toContainText("1 video slot reserved");
  await expect(
    page.getByRole("link", { name: "Open Collection Form" }),
  ).toHaveAttribute("href", "/c/northwind-coffee");
});

test("a downgraded project explains its private-only availability", async ({
  page,
}) => {
  await page.goto("/visual-evidence/inactive-project");
  await expect(
    page.getByRole("region", { name: "Inactive project" }),
  ).toContainText("Collection, the public Wall, and embeds are disabled.");
  await expect(
    page.getByRole("heading", { name: "Harbor Studio", exact: true }),
  ).toBeVisible();
});

test("Billing scrolls to its final controls while navigation stays available", async ({
  page,
}) => {
  await page.goto("/visual-evidence/billing?state=cancellation_scheduled");
  await expect(
    page.getByRole("heading", { name: "Billing", exact: true }),
  ).toBeVisible();
  const content = page.getByRole("region", { name: "Page content" });
  await expect(content).toBeVisible();
  const dimensions = await content.evaluate((element) => ({
    height: element.clientHeight,
    total: element.scrollHeight,
  }));
  expect(dimensions.total).toBeGreaterThan(dimensions.height);
  await content.press("End");
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Manage subscription", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Toggle Sidebar" }),
  ).toBeInViewport();
});

test("the Free project selector saves the Owner's explicit choice", async ({
  page,
}) => {
  await page.goto("/visual-evidence/account-free-project");
  await page.getByRole("combobox", { name: "Your project on Free" }).click();
  await page.getByRole("option", { name: "Northwind Coffee" }).click();
  await expect(
    page.getByRole("combobox", { name: "Your project on Free" }),
  ).toContainText("Northwind Coffee");
  await page.getByRole("button", { name: "Save project choice" }).click();
  await expect(
    page
      .getByRole("region", { name: "Notifications alt+T" })
      .getByText("Free project saved."),
  ).toBeVisible();
});

test("Account deletion requires typing and reviewing the whole-account scope", async ({
  page,
}) => {
  await page.goto("/visual-evidence/account-deletion");
  await expect(page.locator("[data-fixture-ready=true]")).toBeAttached();
  const review = page.getByRole("button", { name: "Review account deletion" });
  await expect(review).toBeDisabled();
  await page
    .getByLabel("Type DELETE ACCOUNT to continue")
    .fill("DELETE ACCOUNT");
  await review.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Your subscription will be canceled");
  await expect(dialog).toContainText(
    "all project data and hosted videos permanently deleted",
  );
  await dialog.getByRole("button", { name: "Keep account" }).click();
  await expect(dialog).not.toBeVisible();
});
