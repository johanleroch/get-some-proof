import { expect, test } from "@playwright/test";

test("Inbox tabs keep the full phone width without losing width to the sync indicator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/visual-evidence/testimonial-inbox");
  const tabs = page.getByRole("tablist", { name: "Testimonial categories" });
  await expect(tabs).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await tabs.evaluate((element) => ({
    content: element.scrollWidth,
    available: element.clientWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.available);
});
