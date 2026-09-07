import { expect, test } from "@playwright/test";

test("marquee pause persists after focus and pointer leave, and can resume", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/templates/marquee");
  const track = page.locator(".template-marquee-track");
  await page.getByRole("button", { name: "Pause animation" }).click();
  await page.getByRole("link", { name: "All templates" }).focus();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "paused");
  const stoppedTransform = await track.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.getByRole("button", { name: "Resume animation" }).click();
  await expect(track).toHaveCSS("animation-play-state", "running");
  await expect
    .poll(() =>
      track.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(stoppedTransform);
});

test("reduced motion makes marquee static and scrollable without an animation button", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/templates/marquee");
  await expect(page.locator(".template-marquee-track")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".template-marquee")).toHaveCSS(
    "overflow-x",
    "auto",
  );
  await expect(
    page.getByRole("button", { name: "Pause animation" }),
  ).toBeHidden();
});
