import { expect, test } from "@playwright/test";

test("private video waits show the mascot and clear on playback, pause or error", async ({
  page,
}) => {
  await page.route("https://stream.mux.com/**", () => {});
  await page.goto("/visual-evidence/managed-video-processing");
  const replacement = page
    .getByRole("status")
    .filter({ hasText: "Replacement: processing" });
  await expect(replacement.locator("svg")).toBeVisible();
  await page
    .getByRole("button", { name: "Play your current video testimonial" })
    .click();
  await page.waitForFunction(() => customElements.get("mux-player"));
  const player = page.locator(
    "mux-player:not([data-mux-player-react-lazy-placeholder])",
  );
  await expect(player).toBeVisible();
  // This test drives lifecycle events explicitly. Detach the real media source
  // so late WebKit loadstart/waiting events cannot race the synthetic events.
  await player.evaluate((element) => {
    element.removeAttribute("playback-id");
    element.removeAttribute("src");
  });
  await player.dispatchEvent("waiting");
  const loader = page
    .getByRole("status")
    .filter({ has: page.getByText("Loading video", { exact: true }) });
  await expect(loader.locator("svg")).toBeVisible();
  for (const event of ["canplay", "playing", "pause", "error"]) {
    await player.dispatchEvent("waiting");
    await expect(loader.locator("svg")).toBeVisible();
    await player.dispatchEvent(event);
    await expect(loader).toHaveCount(0);
  }
});
