import { expect, test } from "@playwright/test";

test("offers assistant import from the testimonial import page", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import-url");
  await expect(
    page.getByRole("heading", {
      name: "Import with an assistant",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Import with an assistant",
      exact: true,
    }),
  ).toHaveAttribute("href", "/org/fernhill-studio/mcp");
});

test("public preview keeps square checkboxes inside touch targets and explains the next step", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import-public");
  await expect(page.getByText("Workspace", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue to save", exact: true }),
  ).toBeEnabled();
  const choice = page.getByRole("checkbox", {
    name: "Select Camille Laurent",
    exact: true,
  });
  const control = await choice.boundingBox();
  const target = await choice.locator("..").boundingBox();
  expect(control!.width).toBe(control!.height);
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue to save", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("keeps selected text when switching formats and explains an empty filter", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import");
  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(
    page.getByText("No video testimonials in this preview.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select this page" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select Camille Laurent", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select Daniel Reed", exact: true }),
  ).toBeChecked();
});

test("corrects identity without changing the quote or losing selection", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import");
  await page
    .getByRole("button", {
      name: "Correct details for Camille Laurent",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Camille Martin");
  await page
    .getByLabel("Role or company", { exact: true })
    .fill("Owner, Atelier June");
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Select Camille Martin", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("Owner, Atelier June", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We had kind words scattered across emails and old pages. Now our customers can see them all in one place.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Correct details for Camille Martin",
      exact: true,
    }),
  ).toBeFocused();
});

test("retries a failed video and reports processing without claiming it is finished", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import-video-failed");
  await page.getByRole("button", { name: "Retry video", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Importing your videos" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "1 video processing. You can leave this page and return later.",
    ),
  ).toBeVisible();
});

test("recovers from an unavailable import preview without a dead end", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import-expired");
  await expect(
    page.getByRole("heading", { name: "This preview is no longer available" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Read a wall again" }).click();
  await expect(page.getByLabel("Public wall URL")).toBeVisible();
  await page
    .getByLabel("Public wall URL")
    .fill("https://testimonial.to/fernhill-studio/all");
  await page
    .getByRole("button", { name: "Preview testimonials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Select testimonials" }),
  ).toBeVisible();
});

test("selects testimonials with the keyboard and keeps the import action reachable", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import");
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  const last = page.getByRole("checkbox", { name: "Select Lina Moreau" });
  await last.focus();
  await last.press("Space");
  await expect(last).toBeChecked();
  await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Import testimonials", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "Select this page" }).check();
  await page
    .getByRole("button", { name: "Import testimonials", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your testimonials are in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Inbox", exact: true }),
  ).toHaveAttribute("href", /\/inbox$/);
  await expect(
    page.getByText(
      "Imported testimonials are Pending. Nothing has been published.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("publishes an imported testimonial only after confirming permission and restores focus", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-import-publication");
  const dialog = page.getByRole("dialog");
  const publish = dialog.getByRole("button", {
    name: "Publish testimonial",
    exact: true,
  });
  await expect(publish).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await publish.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Testimonial published.");
  await page
    .getByRole("button", { name: "Publish testimonial", exact: true })
    .click();
  await expect(publish).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish testimonial", exact: true }),
  ).toBeFocused();
});
