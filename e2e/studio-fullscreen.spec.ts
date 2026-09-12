import { expect, test } from "@playwright/test";

test("copy buttons show the shared toast and briefly confirm successful copies", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copiedValue = value;
        },
      },
    });
  });
  await page.goto("/kit/studio");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const label of ["Copy embed code", "Copy link"]) {
    const button = dialog.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("data-copy-state", "copied");
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      "Copied to clipboard.",
    );
    const value = await page.locator("html").getAttribute("data-copied-value");
    expect(value).toContain(
      label === "Copy link" ? "/widgets/" : "data-gsp-widget=",
    );
    await expect(button).toHaveAttribute("data-copy-state", "idle");
  }
  await expect(
    page
      .locator('[data-slot="studio-editor"] > [role="status"]')
      .filter({ hasText: "Copied" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await dialog.getByRole("button", { name: "Copy link", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Copy link", exact: true }),
  ).toHaveAttribute("data-copy-state", "idle");
  await expect(page.locator("[data-sonner-toast]").first()).toContainText(
    "Could not copy.",
  );
});

test("Studio fills the viewport and keeps editing and preview accessible", async ({
  page,
}, testInfo) => {
  await page.goto("/kit/studio");
  await expect(
    page.getByRole("heading", { name: "Homepage proof" }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  const workspace = await page
    .locator('[data-slot="studio-workspace"]')
    .boundingBox();
  expect(workspace?.width).toBe(page.viewportSize()!.width);
  if (!testInfo.project.name.startsWith("mobile")) {
    const preview = await page.locator("#widget-preview-panel").boundingBox();
    expect(preview?.width).toBe(page.viewportSize()!.width - 320);
    await page.locator("#widget-edit-panel").evaluate((panel) => {
      panel.scrollTop = 150;
    });
    await expect(
      page.getByRole("button", { name: "Widget actions" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("group", { name: "Preview width", exact: true }),
    ).toBeInViewport();
  }
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await expect(
    page.getByRole("button", { name: "Widget actions" }),
  ).toBeVisible();
  if (testInfo.project.name.startsWith("mobile")) {
    await page
      .getByRole("button", { name: "Preview widget", exact: true })
      .click();
  }
  await expect(
    page.getByRole("region", { name: "Widget preview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-widget-preview]")).toContainText(
    "Maya Laurent",
  );
  await page
    .getByRole("button", { name: "Phone preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Phone preview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  if (testInfo.project.name.startsWith("mobile")) {
    await page
      .getByRole("button", { name: "Edit widget", exact: true })
      .click();
  }
  await page
    .getByLabel("Widget name", { exact: true })
    .fill("Homepage stories");
  await page
    .getByRole("button", { name: "Back to Studio", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(page.getByLabel("Widget name", { exact: true })).toHaveValue(
    "Homepage stories",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved.");
  await page
    .getByRole("button", { name: "Back to Studio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Studio", exact: true }),
  ).toBeVisible();
  // Below md the sidebar is a sheet behind the menu button, so only a wide
  // viewport can prove the dashboard shell came back around the widget grid.
  if (!testInfo.project.name.startsWith("mobile"))
    await expect(page.locator('[data-slot="sidebar"]')).not.toHaveCount(0);
});
