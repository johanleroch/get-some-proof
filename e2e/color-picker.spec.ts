import { expect, test } from "@playwright/test";

test("custom color exposes visible keyboard controls for both color axes", async ({
  page,
  browserName,
}) => {
  await page.goto("/visual-evidence/onboarding");
  await page.getByRole("button", { name: "Custom color" }).click();
  const saturation = page.getByRole("slider", { name: "Saturation" });
  const brightness = page.getByRole("slider", { name: "Brightness" });
  await saturation.focus();
  await expect(saturation).toBeFocused();
  await expect(saturation).toBeVisible();
  await expect(saturation).toHaveCSS("height", "44px");
  await expect(saturation.locator("..")).toHaveCSS("position", "static");
  await saturation.press("Home");
  await expect(saturation).toHaveValue("0");
  await expect(saturation).toHaveAttribute("aria-valuetext", "0%");
  await saturation.press("ArrowRight");
  await expect(saturation).toHaveValue("1");
  await saturation.press("End");
  await expect(saturation).toHaveValue("100");
  // Safari follows the system keyboard-navigation preference for native ranges.
  if (browserName === "webkit") await brightness.focus();
  else await saturation.press("Tab");
  await expect(brightness).toBeFocused();
  await expect(brightness).toBeVisible();
  await brightness.press("Home");
  await expect(page.getByRole("textbox", { name: "Hex" })).toHaveValue(
    "#000000",
  );
});
