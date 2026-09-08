import { test, expect } from "@playwright/test";

test("section links keep the shell fixed and page content scrollable", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Section navigation is desktop only");
  await page.goto("/visual-evidence/project-settings-shell");
  const content = page.getByRole("region", { name: "Page content" });
  await expect(content).toHaveCSS("scroll-behavior", "smooth");
  const before = await content.boundingBox();
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Embedded Wall", exact: true })
    .click();
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
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Brand logo", exact: true })
    .click();
  await expect
    .poll(async () => (await content.boundingBox())!.y)
    .toBe(before!.y);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(content).toHaveCSS("scroll-behavior", "auto");
});
