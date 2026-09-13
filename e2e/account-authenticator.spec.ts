import { expect, test } from "@playwright/test";

// Exercise the real Authenticator page with synthetic auth responses only.
test("a refused setup answers under the field and offers a fresh sign-in", async ({
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
  await page.goto("/visual-evidence/live-authenticator");

  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Continue" }).click();

  // In place, beside the field that was refused, not in a toast that leaves.
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "That password is incorrect.",
  );
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(page.getByLabel("Digit 1 of 6")).toHaveCount(0);

  await page.route("**/api/auth/two-factor/enable", (route) =>
    route.fulfill({ status: 403, json: { code: "SESSION_NOT_FRESH" } }),
  );
  await page.getByLabel("Current password").fill("synthetic-password");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This security action needs a recent sign-in.",
  );
  await page.getByRole("link", { name: "Sign in again" }).click();
  await expect(page).toHaveURL(
    /sign-in\?callbackURL=%2Faccount%2Fsecurity%2Fauthenticator/,
  );
});
