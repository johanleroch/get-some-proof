import { expect, test } from "@playwright/test";

test("annual Billing shows the charged total and historical invoice downloads", async ({
  page,
}) => {
  await page.goto("/visual-evidence/billing");
  const annual = page.getByRole("button", { name: "Annual · 2 months free" });
  await annual.click();
  await expect(annual).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/24.17.*billed annually/)).toBeVisible();
  await expect(page.getByText(/Save.*58.*a year/)).toBeVisible();
  const download = page.getByRole("link", {
    name: "Download PDF GSP-2026-0042",
  });
  await expect(download).toHaveAttribute(
    "href",
    "https://invoice.stripe.com/i/fixture/pdf",
  );
  await expect(
    page.getByRole("button", { name: "Manage billing", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
