import { expect, test } from "@playwright/test";

test("loading buttons preserve their accessible name", async ({ page }) => {
  await page.goto("/kit");
  const button = page.getByRole("button", {
    name: "Save settings",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toHaveAccessibleName("Save settings");
  const mascot = button.locator('svg[id^="blob-anim-"]');
  await expect(mascot).toBeVisible();
  const mascotSize = await mascot.boundingBox();
  expect(mascotSize?.width).toBe(24);
  expect(mascotSize?.height).toBe(24);
  const widths = await button.evaluate((loadingButton) => {
    const idleButton = loadingButton.cloneNode(true) as HTMLButtonElement;
    idleButton.replaceChildren(document.createTextNode("Save settings"));
    loadingButton.after(idleButton);
    const result = [
      loadingButton.getBoundingClientRect().width,
      idleButton.getBoundingClientRect().width,
    ];
    idleButton.remove();
    return result;
  });
  expect(widths[0]).toBeCloseTo(widths[1], 2);
});
