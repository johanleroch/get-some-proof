import { expect, test } from "@playwright/test";
import { installRecorderCamera } from "./helpers/recorder-camera";

for (const [name, width, height] of [
  ["landscape", 1280, 720],
  ["portrait", 720, 1280],
  ["standard", 640, 480],
  ["unsupported", 640, 480],
] as const) {
  test(`recorder handles ${name} source with native recording or upload fallback`, async ({
    page,
  }) => {
    await installRecorderCamera(page, width, height);
    if (name === "unsupported") {
      await page.addInitScript(() => {
        Object.defineProperty(window, "MediaRecorder", {
          configurable: true,
          value: undefined,
        });
      });
    }
    await page.goto("/visual-evidence/collection-form");
    await page
      .getByRole("button", { name: /Record or upload a video/ })
      .click();
    // Linux WebKit can omit MediaRecorder. Exercise the real upload fallback
    // there; never replace the encoder with a mock to claim recording coverage.
    if (!(await page.evaluate(() => typeof MediaRecorder !== "undefined"))) {
      await expect(
        page.getByText("Recording isn't supported here.", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Choose a video" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open camera" }),
      ).toHaveCount(0);
      test.info().annotations.push({
        type: "coverage",
        description:
          "Native MediaRecorder unavailable: verified upload fallback; real encoding is tested on supported runtimes.",
      });
      return;
    }
    await page.getByRole("button", { name: "Open camera" }).click();
    const assertRatio = async (label: string) => {
      const video = page.getByLabel(label);
      await expect
        .poll(() =>
          video.evaluate((element: HTMLVideoElement) => element.videoWidth),
        )
        .toBeGreaterThan(0);
      const dimensions = await video.evaluate((element: HTMLVideoElement) => {
        const frame = element.parentElement!.getBoundingClientRect();
        return {
          ratio: frame.width / frame.height,
          height: frame.height,
          intrinsicRatio: element.videoWidth / element.videoHeight,
        };
      });
      expect(dimensions.intrinsicRatio).toBeCloseTo(width / height, 2);
      expect(dimensions.ratio).toBeCloseTo(width / height, 2);
      expect(dimensions.height).toBeLessThanOrEqual(
        page.viewportSize()!.height * 0.65 + 1,
      );
    };
    await assertRatio("Camera preview");
    const viewport = page.viewportSize()!;
    await page.setViewportSize({
      width: viewport.width < 640 ? 1280 : 390,
      height: viewport.height,
    });
    await assertRatio("Camera preview");
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(page.getByText("00:01", { exact: true })).toBeVisible();
    await assertRatio("Camera preview");
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page
      .getByLabel("Recorded video preview")
      .evaluate(async (video: HTMLVideoElement) => {
        await video.play();
      });
    await assertRatio("Recorded video preview");
    await page
      .getByLabel("Recorded video preview")
      .evaluate((video: HTMLVideoElement) => video.pause());
    await page.getByRole("button", { name: "Record again" }).click();
    await assertRatio("Camera preview");
  });
}
