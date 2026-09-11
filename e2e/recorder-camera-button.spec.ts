import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`camera button is not clipped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    // This is a layout test, independent of camera support on the CI host.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => new MediaStream(),
          enumerateDevices: async () => [],
        },
      });
      if (typeof MediaRecorder === "undefined") {
        Object.defineProperty(window, "MediaRecorder", {
          configurable: true,
          value: class {},
        });
      }
    });
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
    await button.click();
    await expect(
      page.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
  });
}
