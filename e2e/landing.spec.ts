import { expect, test } from "@playwright/test";

test("the signed-out homepage explains the offer and starts sign-up", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your happy customers can help win the next ones.",
    }),
  ).toBeVisible();

  const account = page.getByRole("navigation", { name: "Account" });
  await account.getByRole("link", { name: "Start for free" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();

  await page.goBack();
  await account.getByRole("link", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("every demonstration on the homepage is labeled as one", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("demo wall, nobody real yet")).toBeVisible();
  await expect(
    page.getByText(
      "Fernhill Studio and every testimonial on this page are invented.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The embed a website loads, rendering invented testimonials.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/demonstration content from a fictional studio/i),
  ).toBeVisible();
});

test("the homepage fits a 320px screen without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ height: 640, width: 320 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(horizontalOverflow).toBe(false);
});

test("the Widget demonstration renders the real embed and follows its controls", async ({
  page,
}) => {
  await page.goto("/");

  const stage = page.locator("[data-widget-preview]");
  await expect(stage.getByText("Remy Jupille")).toBeVisible();

  await page.getByLabel("Template").click();
  await page.getByRole("option", { name: /Individual testimonial/ }).click();
  // One voice: the other published pieces leave the frame.
  await expect(stage.getByText("Alice Martin")).toBeHidden();
  await expect(stage.getByText("Remy Jupille")).toBeVisible();
});
