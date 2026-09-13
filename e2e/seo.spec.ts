import { expect, test } from "@playwright/test";

test("share metadata is present in crawler HTML and its image is fetchable", async ({
  request,
}) => {
  const response = await request.get("/templates", {
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('property="og:title" content="Testimonial templates"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  const imageUrl = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(imageUrl).toBeTruthy();
  expect(new URL(imageUrl!).pathname).toBe("/brand/social-card.png");
  const image = await request.get(new URL(imageUrl!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  expect(bytes.length).toBeLessThan(1_000_000);
});

test("authentication stays noindex while public templates have a canonical URL", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await page.goto("/templates");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /https?:\/\/[^/]+\/templates$/,
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/templates</loc>");
  expect(sitemap).not.toContain("/sign-in");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("/sitemap.xml");
});
