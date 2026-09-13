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
    if (pathname.endsWith("/list-sessions"))
      json = [
        {
          id: "session-1",
          token: "other-session-token",
          createdAt: "2026-08-30T10:00:00.000Z",
          updatedAt: "2026-08-30T11:00:00.000Z",
          expiresAt: "2026-09-06T10:00:00.000Z",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0 (Macintosh)",
        },
      ];
    await route.fulfill({ json });
  });
  await page.route("**/api/auth/revoke-other-sessions", (route) =>
    route.fulfill({ status: 429, json: { code: "TOO_MANY_ATTEMPTS" } }),
  );
  await page.goto("/visual-evidence/account-security");
  await page
    .getByRole("button", { name: "Revoke every other Session" })
    .click();
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText("Too many attempts.");
  await expect(toast.locator("svg").first()).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toHaveCount(0);
  await page.route("**/api/auth/revoke-other-sessions", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "SESSION_NOT_FRESH" },
    }),
  );
  await page
    .getByRole("button", { name: "Revoke every other Session" })
    .click();
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

// The way in to the Authenticator reflects what the account already has.
test("Security points at the Authenticator and says where it stands", async ({
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
  await page.goto("/visual-evidence/account-security");

  await expect(page.getByText(/^Off\./)).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up" })).toHaveAttribute(
    "href",
    "/account/security/authenticator",
  );
  // Nothing about the setup itself happens on this page any more.
  await expect(page.getByLabel("Current password")).toHaveCount(0);
});
