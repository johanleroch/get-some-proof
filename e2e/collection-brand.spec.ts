import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`Collection Form keeps customer colors on checked and hovered controls in ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((value) => {
      localStorage.setItem("get-some-proof-theme", value);
    }, theme);
    await page.goto("/visual-evidence/collection-form-details");
    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeChecked();
    // The fixture Brand uses teal. This checks the rendered shared primitive,
    // including its checked variant, rather than just inspecting token values.
    await expect(checkbox).toHaveCSS("background-color", "rgb(15, 118, 110)");
    await expect(checkbox).toHaveCSS("border-color", "rgb(15, 118, 110)");
    const submit = page.getByRole("button", { name: "Submit testimonial" });
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS("background-color", "rgb(15, 118, 110)");
    await submit.hover();
    await expect(submit).toHaveCSS("background-color", "rgb(15, 118, 110)");
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    expect(
      await checkbox.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--ring").trim(),
      ),
    ).toContain("#0f766e");
  });
}
