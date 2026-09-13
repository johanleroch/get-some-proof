import { test, expect } from "@playwright/test";

/**
 * The settings shell scrolls its page-content region, not the window, so the
 * sidebar and the page header stay put. The section navigation this test used
 * to drive was removed with the responsive settings pass; the scrolling
 * contract it proved is still the thing that matters.
 */
test("keeps the shell fixed while the page content scrolls", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The page itself scrolls on mobile");
  await page.goto("/visual-evidence/project-settings-shell");
  const content = page.getByRole("region", { name: "Page content" });
  await expect(content).toHaveCSS("scroll-behavior", "smooth");
  const before = await content.boundingBox();
  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() =>
      content.evaluate((element) =>
        Math.abs(
          element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      ),
    )
    .toBeLessThan(2);
  await expect
    .poll(async () => (await content.boundingBox())!.y)
    .toBe(before!.y);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(content).toHaveCSS("scroll-behavior", "auto");
});
