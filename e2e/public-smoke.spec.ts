import { expect, test } from "@playwright/test";

test("sign-in is accessible and responsive", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toHaveAttribute("href", "/forgot-password");
  await expect(
    page.getByRole("link", { name: "Create an account" }),
  ).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(horizontalOverflow).toBe(false);
});

test("password recovery remains keyboard reachable", async ({
  browserName,
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").focus();
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
});

for (const route of [
  "/sign-in",
  "/sign-up",
  "/reset-password?token=example-token",
]) {
  test(`password visibility works by keyboard on ${route}`, async ({
    browserName,
    page,
  }) => {
    await page.goto(route);
    const password = page.locator('input[name="password"]');
    await password.fill("Example-only-42!");
    await expect(password).toHaveAttribute("type", "password");
    await password.focus();
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(
      page.getByRole("button", { name: "Show password" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("Example-only-42!");
    await page.keyboard.press("Space");
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("Example-only-42!");
    expect(new URL(page.url()).pathname).toBe(route.split("?")[0]);
  });
}
