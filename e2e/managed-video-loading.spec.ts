import { expect, test } from "@playwright/test";

test("private video waits show the mascot and clear on playback, pause or error", async ({
  page,
}) => {
  await page.route("https://stream.mux.com/**", (route) => route.abort());
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
  // Test the UI's lifecycle handlers independently of HLS. Mux forwards native
  // events asynchronously and React can restore playback-id on re-render, so
  // removing the source alone does not isolate this synthetic event sequence.
  await player.evaluate((element) => {
    for (const name of [
      "loadstart",
      "waiting",
      "canplay",
      "playing",
      "pause",
      "error",
    ]) {
      element.addEventListener(
        name,
        (event) => {
          if (!(event instanceof CustomEvent && event.detail?.fixtureLifecycle))
            event.stopImmediatePropagation();
        },
        { capture: true },
      );
    }
  });
  const lifecycle = (name: string) =>
    player.evaluate((element, name) => {
      element.dispatchEvent(
        new CustomEvent(name, { detail: { fixtureLifecycle: true } }),
      );
    }, name);
  await lifecycle("waiting");
  const loader = page
    .getByRole("status")
    .filter({ has: page.getByText("Loading video", { exact: true }) });
  await expect(loader.locator("svg")).toBeVisible();
  for (const event of ["canplay", "playing", "pause", "error"]) {
    await lifecycle("waiting");
    await expect(loader.locator("svg")).toBeVisible();
    await lifecycle(event);
    await expect(loader).toHaveCount(0);
  }
});
