import { expect, test } from "@playwright/test";

test("Inbox dates hydrate without replacing the server-rendered tree", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/visual-evidence/testimonial-inbox");
  await page.getByRole("tab", { name: "Published" }).click();
  await expect(page.getByRole("tab", { name: "Published" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(errors.filter((error) => error.includes("Hydration failed"))).toEqual(
    [],
  );
});
