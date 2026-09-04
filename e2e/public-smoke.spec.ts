import { expect, test } from "@playwright/test";

test("sign-in is accessible and responsive", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
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
