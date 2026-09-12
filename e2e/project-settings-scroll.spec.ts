import { test, expect } from "@playwright/test";

test("settings content scrolls inside the fixed application shell", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop application shell scrolling");
  await page.goto("/visual-evidence/project-settings-shell");
  const content = page.getByRole("region", { name: "Page content" });
  await expect(content).toHaveCSS("scroll-behavior", "smooth");
  expect(
    await content.evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeGreaterThan(0);
  const before = await content.boundingBox();
  await content.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect
    .poll(async () => (await content.boundingBox())!.y)
    .toBe(before!.y);
  await expect
    .poll(() =>
      content.evaluate((el) =>
        Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop),
      ),
    )
    .toBeLessThan(2);
  expect(await content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await content.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect
    .poll(async () => (await content.boundingBox())!.y)
    .toBe(before!.y);
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBe(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(content).toHaveCSS("scroll-behavior", "auto");
});
