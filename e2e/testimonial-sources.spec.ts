import { expect, test } from "@playwright/test";
test("source logos open original reviews and can be hidden for text and video", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-sources");
  await expect(
    page.getByRole("link", { name: "Source: Google" }),
  ).toHaveAttribute("href", "https://www.google.com/maps/reviews/1");
  await expect(
    page.getByRole("link", { name: "Source: LinkedIn" }),
  ).toHaveAttribute("target", "_blank");
  await page
    .getByRole("switch", { name: "Show original source logos" })
    .click();
  await page.getByRole("button", { name: "Save Public Wall" }).click();
  await expect(page.locator("[data-gsp-source]")).toHaveCount(0);
  await page
    .getByRole("switch", { name: "Show original source logos" })
    .click();
  await page.getByRole("button", { name: "Save Public Wall" }).click();
  await expect(page.locator("[data-gsp-source]")).toHaveCount(2);
});
