import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

type VisualEvidenceConfig = {
  screens: Array<{ slug: string; fixturePath?: string; heading: string }>;
};

const config = JSON.parse(
  await readFile(
    new URL("../visual-evidence.config.json", import.meta.url),
    "utf8",
  ),
) as VisualEvidenceConfig;

/**
 * The Inbox fixtures the gallery and the visual evidence rely on. Each one
 * must answer, and its registered heading must be the h1/h2 the capture
 * waits for (`getByRole("heading", { exact: true })`).
 */
const inboxFixtureSlugs = [
  "testimonial-inbox",
  "testimonial-inbox-published",
  "testimonial-inbox-details",
  "testimonial-delete",
] as const;

for (const slug of inboxFixtureSlugs) {
  test(`/visual-evidence/${slug} answers with its registered heading`, async ({
    page,
    request,
  }) => {
    const fixturePath = `/visual-evidence/${slug}`;
    const screen = config.screens.find(
      (candidate) => candidate.fixturePath === fixturePath,
    );
    expect(screen, `${fixturePath} is registered in the config`).toBeDefined();
    const response = await request.get(fixturePath);
    expect(response.status()).toBe(200);
    await page.goto(fixturePath);
    await expect(
      page.getByRole("heading", { name: screen!.heading, exact: true }),
    ).toBeVisible();
  });
}

test("Open Public Wall opens the Brand's Wall in a new tab", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-inbox");
  const link = page.getByRole("link", { name: "Open Public Wall" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/w/fernhill-studio");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("the tabs carry their counts and Go to Pending returns to the queue", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-inbox");
  const tabs = page.getByRole("tablist", { name: "Testimonial categories" });
  await expect(tabs.getByRole("tab", { name: "Pending 3" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(tabs.getByRole("tab", { name: "Published 2" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Archived" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Spam 1" })).toBeVisible();
  await expect(page.getByText("Nora Lewis", { exact: true })).toBeVisible();

  await tabs.getByRole("tab", { name: "Archived" }).click();
  await expect(tabs.getByRole("tab", { name: "Archived" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Nothing Archived")).toBeVisible();
  await page.getByRole("button", { name: "Go to Pending" }).click();
  await expect(tabs.getByRole("tab", { name: "Pending 3" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Nora Lewis", { exact: true })).toBeVisible();

  await tabs.getByRole("tab", { name: "Published 2" }).click();
  await expect(
    page.getByRole("button", { name: "Move Remy Jupille up" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Move Alice Martin down" }),
  ).toBeDisabled();

  await tabs.getByRole("tab", { name: "Spam 1" }).click();
  await expect(page.getByRole("button", { name: "Not Spam" })).toBeVisible();
});

test("the screens gallery lists the inbox screens with their fixtures", async ({
  request,
}) => {
  const response = await request.get("/screens");
  expect(response.status()).toBe(200);
  const html = await response.text();
  for (const expected of [
    "Testimonial inbox",
    "Inbox, Published",
    "Details shown on the Wall",
    "Delete a Testimonial",
    "/visual-evidence/testimonial-inbox",
    "/visual-evidence/testimonial-inbox-published",
    "/visual-evidence/testimonial-inbox-details",
    "/visual-evidence/testimonial-delete",
    "/org/:organizationSlug/inbox",
  ]) {
    expect(html, `gallery lists ${expected}`).toContain(expected);
  }
});
