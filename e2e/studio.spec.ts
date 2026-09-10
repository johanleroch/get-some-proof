import { expect, test } from "@playwright/test";

test("creates a widget, selects proof, saves, publishes and keeps its code", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio");
  await page
    .getByRole("button", { name: "Create widget", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Individual testimonial One voice/ })
    .click();
  await page.getByLabel("Widget name", { exact: true }).fill("Pricing proof");
  await page.getByRole("checkbox", { name: "Select Maya Laurent" }).check();
  if ((page.viewportSize()?.width ?? 1440) < 1024)
    await page
      .getByRole("button", { name: "Preview widget", exact: true })
      .click();
  await expect(
    page
      .locator("[data-widget-preview]")
      .getByText("Maya Laurent", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const code = await page
    .getByLabel("Embed code", { exact: true })
    .inputValue();
  expect(code).toContain("data-gsp-widget=");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Back to Studio" }).click();
  await expect(
    page.getByRole("button", { name: /^Pricing proof Individual/ }),
  ).toBeVisible();
});

test("reorders selected proof and switches to real highlights", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio-editor");
  await page.getByRole("button", { name: "Move James Carter up" }).click();
  await expect(
    page
      .getByRole("list", { name: "Selected testimonials" })
      .locator("li")
      .first(),
  ).toContainText("James Carter");
  await page.getByLabel("Template", { exact: true }).click();
  await page
    .getByRole("option", { name: "Testimonial highlights", exact: true })
    .click();
  if ((page.viewportSize()?.width ?? 1440) < 1024)
    await page
      .getByRole("button", { name: "Preview widget", exact: true })
      .click();
  const preview = page.locator("[data-widget-preview]");
  await expect(
    preview.getByText("The proof speaks for itself.", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText(/We added it beside/)).toHaveCount(0);
  await page.getByRole("button", { name: "Mobile preview" }).click();
  await expect(
    page.getByRole("button", { name: "Mobile preview" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((body) => body.clientWidth),
  );
});

test("protects unsaved edits when following an internal link", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio-editor");
  await expect(
    page.locator("[data-widget-preview] .card").first(),
  ).toBeAttached();
  await page.getByLabel("Widget name", { exact: true }).fill("Unsaved name");
  // Represent the app-shell link that sits outside the isolated gallery editor.
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/visual-evidence/studio";
    link.textContent = "Sidebar Studio";
    document.body.prepend(link);
  });
  await page.getByRole("link", { name: "Sidebar Studio" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Widget name", { exact: true })).toHaveValue(
    "Unsaved name",
  );
  await page.getByRole("link", { name: "Sidebar Studio" }).click();
  await page.getByRole("button", { name: "Leave editor" }).click();
  await expect(page).toHaveURL(/\/visual-evidence\/studio$/);
});
