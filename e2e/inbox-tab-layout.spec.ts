import { expect, test, type Page } from "@playwright/test";

async function tabGeometry(page: Page) {
  const tablist = page.getByRole("tablist", {
    name: "Testimonial categories",
  });
  await expect(tablist).toBeVisible();
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  return tabs.evaluateAll((tabs) =>
    tabs.map((tab) => {
      const rect = tab.getBoundingClientRect();
      return {
        left: Math.round(rect.left * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
      };
    }),
  );
}

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

test("Inbox tabs keep the same geometry while their counts load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/visual-evidence/testimonial-inbox");
  await page.evaluate(() => document.fonts.ready);
  const loaded = await tabGeometry(page);

  await page.goto("/visual-evidence/inbox-loading");
  await page.evaluate(() => document.fonts.ready);

  expect(await tabGeometry(page)).toEqual(loaded);
});

test("Inbox count slots contain the supported 500+ ceiling on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/visual-evidence/testimonial-inbox");
  const countSlot = page.locator('[data-slot="inbox-category-count"]').first();
  await countSlot
    .locator('[data-slot="inbox-category-count-value"]')
    .evaluate((count) => {
      count.textContent = "500+";
    });

  const dimensions = await countSlot.evaluate((slot) => ({
    available: slot.clientWidth,
    content: slot.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.available);
});
