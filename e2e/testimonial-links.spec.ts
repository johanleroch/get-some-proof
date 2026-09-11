import { expect, test } from "@playwright/test";

test("mentions open their source and disabling preserves all visible words", async ({
  page,
}) => {
  await page.goto("/visual-evidence/testimonial-links");
  const quote = page.locator("blockquote");
  const original = await quote.innerText();
  const mention = quote.getByRole("link", { name: "@atelierrose" });
  await expect(mention).toHaveAttribute(
    "href",
    "https://example.com/atelierrose",
  );
  await expect(mention).toHaveAttribute("target", "_blank");
  await expect(mention).toHaveAttribute("rel", /noopener/);
  await mention.focus();
  await expect(mention).toBeFocused();
  await expect(quote.locator("mark")).toHaveText("@lina");
  const toggle = page.getByRole("switch", {
    name: "Allow links in testimonials",
  });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(quote.getByRole("link")).toHaveCount(0);
  await expect(quote).toHaveText(original);
  await expect(quote.locator("mark")).toHaveText("@lina");
  await toggle.click();
  await expect(quote.getByRole("link")).toHaveCount(2);
});
