import { test, expect } from "@playwright/test";

test("scrolling between settings sections keeps the shell fixed", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop shell scrolling regression");
  await page.goto("/visual-evidence/project-settings-shell");
  const content = page.getByRole("region", { name: "Page content" });
  await expect(content).toHaveCSS("scroll-behavior", "smooth");
  const before = await content.boundingBox();
  await page
    .getByRole("heading", { name: "Embedded Wall", exact: true })
    .scrollIntoViewIfNeeded();
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
  await page
    .getByRole("button", { name: "Upload brand logo", exact: true })
    .scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await content.boundingBox())!.y)
    .toBe(before!.y);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(content).toHaveCSS("scroll-behavior", "auto");
});
