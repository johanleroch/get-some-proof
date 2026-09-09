import { expect, test } from "@playwright/test";

// Exercise the real account screen with synthetic auth responses only.
test("security errors use the branded toast and support retry and reauthentication", async ({
  page,
}) => {
  await page.route("**/api/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let json: unknown = null;
    if (pathname.endsWith("/list-accounts"))
      json = [{ providerId: "credential" }];
    if (pathname.endsWith("/list-sessions")) json = [];
    await route.fulfill({ json });
  });
  await page.route("**/api/auth/two-factor/enable", (route) =>
    route.fulfill({
      status: 400,
      json: { code: "INVALID_PASSWORD", message: "Invalid password" },
    }),
  );
  await page.goto("/visual-evidence/account-security");
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Enable 2FA" }).click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText("That password is incorrect.");
  await expect(toast.locator("svg").first()).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toHaveCount(0);
  await page.route("**/api/auth/two-factor/enable", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "SESSION_NOT_FRESH" },
    }),
  );
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Enable 2FA" }).click();
  await expect(toast).toContainText(
    "This security action needs a recent sign-in.",
  );
  await expect(
    toast.getByRole("button", { name: "Sign in again" }),
  ).toBeVisible();
  const bounds = await toast.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await toast.getByRole("button", { name: "Sign in again" }).click();
  await expect(page).toHaveURL(/sign-in\?callbackURL=%2Faccount%2Fsecurity/);
});
