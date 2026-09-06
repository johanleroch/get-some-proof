import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`camera button is not clipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/visual-evidence/collection-form");
    await page
      .getByRole("button", { name: /Record or upload a video/ })
      .click();
    const button = page.getByRole("button", { name: "Open camera" });
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const clipped = await button.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (!["hidden", "clip"].includes(getComputedStyle(parent).overflowY))
          continue;
        const clip = parent.getBoundingClientRect();
        if (bounds.top < clip.top || bounds.bottom > clip.bottom) return true;
      }
      return false;
    });
    expect(clipped, "Open camera must fit inside every clipping ancestor").toBe(
      false,
    );
    await expect(page.getByLabel("Spoken language")).toHaveCount(0);
    await page.evaluate(() => {
      const prototype = Object.getPrototypeOf(navigator.mediaDevices);
      Object.defineProperty(prototype, "getUserMedia", {
        configurable: true,
        value: async () => new MediaStream(),
      });
      Object.defineProperty(prototype, "enumerateDevices", {
        configurable: true,
        value: async () => [],
      });
    });
    await button.click();
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    const ratio = await page.getByLabel("Camera preview").evaluate((video) => {
      const frame = video.parentElement!.getBoundingClientRect();
      return frame.width / frame.height;
    });
    expect(ratio).toBeCloseTo(width < 640 ? 9 / 16 : 16 / 9, 2);
  });
}
