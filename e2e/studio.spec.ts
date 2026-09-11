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
  await page.getByRole("button", { name: "Manage selection" }).click();
  await page.getByRole("checkbox", { name: "Select Maya Laurent" }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
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
  await page.getByRole("button", { name: "Manage selection" }).click();
  await page.getByRole("tab", { name: "Selected (3)", exact: true }).click();
  await page.getByRole("button", { name: "Move James Carter up" }).click();
  await expect(
    page
      .getByRole("list", { name: "Selected testimonials" })
      .locator("li")
      .first(),
  ).toContainText("James Carter");
  await page.getByRole("button", { name: "Done", exact: true }).click();
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
  await expect(
    preview.getByRole("link", { name: "Source: Google" }),
  ).toHaveAttribute("href", "https://www.google.com/maps/reviews/1");
  await expect(
    preview.locator('a[href="https://example.com/customer-story"]'),
  ).toBeVisible();
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

test("keeps selection out of the sidebar and supports search, removal and focus return", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio-editor");
  const manage = page.getByRole("button", {
    name: "Manage selection",
    exact: true,
  });
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await manage.click();
  const dialog = page.getByRole("dialog", { name: "Manage testimonials" });
  await expect(
    dialog.getByRole("checkbox", { name: "Select Alex Thomas" }),
  ).toHaveCount(0);
  await dialog
    .getByRole("textbox", { name: "Search testimonials" })
    .fill("Alex");
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog.getByRole("checkbox", { name: "Select Alex Thomas" }).check();
  await dialog.getByRole("tab", { name: "Selected (4)", exact: true }).click();
  await expect(
    dialog.getByRole("list", { name: "Selected testimonials" }).locator("li"),
  ).toHaveCount(4);
  await dialog
    .getByRole("button", { name: "Remove Alex Thomas", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(manage).toBeFocused();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  await manage.click();
  await expect(
    dialog.getByRole("textbox", { name: "Search testimonials" }),
  ).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(manage).toBeFocused();
});

test("selects and clears all loaded testimonials from the selection dialog", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio-editor");
  await page
    .getByRole("button", { name: "Manage selection", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Manage testimonials" });
  const selectAll = dialog.getByRole("checkbox", {
    name: "Select all",
    exact: true,
  });
  const captureToggleFrames = () =>
    dialog.evaluate(async (root) => {
      const checkbox = root.querySelector('[role="checkbox"]');
      const firstCard = root.querySelector("[data-studio-testimonial]");
      if (!(checkbox instanceof HTMLElement) || !firstCard) {
        throw new Error("Expected the bulk checkbox and a testimonial card");
      }
      const snapshot = () =>
        [root, checkbox, firstCard].map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        });
      const frames = [snapshot()];
      checkbox.click();
      for (let index = 0; index < 18; index += 1) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        frames.push(snapshot());
      }
      return frames;
    });

  await expect(selectAll).toHaveAttribute("data-state", "indeterminate");
  const selectFrames = await captureToggleFrames();
  for (const frame of selectFrames) expect(frame).toEqual(selectFrames[0]);
  await expect(
    dialog.getByRole("tab", { name: "Selected (4)", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("4 / 50 selected", { exact: true }),
  ).toBeVisible();

  const clearFrames = await captureToggleFrames();
  for (const frame of clearFrames) expect(frame).toEqual(clearFrames[0]);
  await expect(
    dialog.getByRole("tab", { name: "Selected (0)", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("0 / 50 selected", { exact: true }),
  ).toBeVisible();

  await dialog
    .getByRole("button", { name: "Load more testimonials", exact: true })
    .click();
  await expect(dialog.getByText("56 shown", { exact: true })).toBeVisible();
  await selectAll.click();
  await expect(
    dialog.getByText("50 / 50 selected", { exact: true }),
  ).toBeVisible();
  await expect(selectAll).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Clear shown", exact: true })
    .click();
  await expect(
    dialog.getByText("0 / 50 selected", { exact: true }),
  ).toBeVisible();

  await dialog
    .getByRole("textbox", { name: "Search testimonials" })
    .fill("Maya");
  await expect(dialog.getByText("1 shown", { exact: true })).toBeVisible();
  await selectAll.check();
  await expect(
    dialog.getByRole("tab", { name: "Selected (1)", exact: true }),
  ).toBeVisible();
});

test("shows Inbox presentation and previews video without changing selection", async ({
  page,
}) => {
  await page.goto("/visual-evidence/studio-editor");
  await page
    .getByRole("button", { name: "Manage selection", exact: true })
    .click();
  const selection = page.getByRole("dialog", { name: "Manage testimonials" });
  const maya = selection.locator('[data-studio-testimonial="maya"]');
  await expect(
    maya.getByText("Founder · Atelier June", { exact: true }),
  ).toBeVisible();
  await expect(maya.locator("mark")).toContainText(
    "Our customers finally have a place to tell their stories.",
  );
  await expect(
    maya.getByRole("img", { name: "Image 1 from Maya Laurent" }),
  ).toBeVisible();
  const preview = selection.getByRole("button", {
    name: "Preview Remy Jupille's video",
    exact: true,
  });
  await preview.click();
  await expect(
    page.getByRole("dialog", { name: "Remy Jupille’s video", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(selection).toBeVisible();
  await expect(preview).toBeFocused();
  await expect(
    selection.getByRole("tab", { name: "Selected (3)", exact: true }),
  ).toBeVisible();
  await selection
    .getByRole("checkbox", { name: "Select Remy Jupille", exact: true })
    .check();
  await selection
    .getByRole("tab", { name: "Selected (4)", exact: true })
    .click();
  await expect(
    selection.getByRole("button", {
      name: "Preview Remy Jupille's video",
      exact: true,
    }),
  ).toBeVisible();
});
