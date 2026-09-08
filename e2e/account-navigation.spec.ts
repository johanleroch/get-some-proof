import { expect, test } from "@playwright/test";

test("Account profile keeps the selected project's Overview reachable", async ({
  page,
  isMobile,
}) => {
  await page.goto("/visual-evidence/profile");
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const overview = page.getByRole("link", {
    name: "Back to project",
    exact: true,
  });
  await expect(overview).toBeVisible();
  await expect(overview).toHaveAttribute(
    "href",
    "/org/harbor-studio/dashboard",
  );
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Security", exact: true }),
  ).toBeVisible();
  // Fixtures are signed out: observe the link destination before the auth guard
  // redirects it, without creating a real account or bypassing authentication.
  const request = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/org/harbor-studio/dashboard",
  );
  await overview.click();
  await request;
});
