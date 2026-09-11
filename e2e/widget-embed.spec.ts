import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { widgetPayload } from "../src/components/studio/widget-payload";
const id = "12345678-1234-4234-8234-123456789abc";
const testimonials = Array.from({ length: 4 }, (_, index) => ({
  id: `card-${index}`,
  name: ["Maya Laurent", "James Carter", "Sarah Reed", "Alex Thomas"][index],
  avatarUrl: null,
  publishedAt: 1,
  type: "text" as const,
  text: `Customer story ${index + 1}. A useful change for our small business.`,
}));
const config = {
  layout: "carousel" as const,
  font: "inherit" as const,
  accentColor: "#ffbb16",
  backgroundColor: "#ffffff",
  textColor: "#2e2a25",
};
test.beforeEach(async ({ page }) => {
  await page.route("https://widgets.example/embed/v2.js", async (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: await readFile("public/embed/v2.js", "utf8"),
    }),
  );
});

test("copied code renders isolated duplicate widgets with one fetch and accessible carousel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requests = 0;
  await page.route("**/api/widgets/**", async (route) => {
    requests++;
    await route.fulfill({
      json: widgetPayload({
        config,
        brandName: "Cedar Workshop",
        attributionRequired: false,
        testimonials,
      }),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.route("https://customer.example/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><title>Customer website</title><style>body{font-family:Georgia,serif}article,p{color:lime!important;text-transform:uppercase!important}</style></head><body><div style="max-width:600px"><div data-gsp-widget="${id}"></div><div data-gsp-widget="${id}"></div></div><script src="https://widgets.example/embed/v2.js" async></script></body></html>`,
    }),
  );
  await page.goto("https://customer.example/");
  const hosts = page.locator("[data-gsp-widget]");
  await expect(hosts.first()).toHaveAttribute("data-gsp-state", "ready");
  await expect(hosts.nth(1)).toHaveAttribute("data-gsp-state", "ready");
  expect(requests).toBe(1);
  await expect(
    hosts.first().getByText("Maya Laurent", { exact: true }),
  ).toBeVisible();
  const color = await hosts
    .first()
    .locator(".name")
    .first()
    .evaluate((node) => getComputedStyle(node).color);
  expect(color).not.toBe("rgb(0, 255, 0)");
  await hosts
    .first()
    .getByRole("button", { name: "Next testimonials" })
    .click();
  await expect
    .poll(() =>
      hosts
        .first()
        .locator(".grid")
        .evaluate((node) => node.scrollLeft),
    )
    .toBeGreaterThan(0);
  await hosts.first().locator(".grid").focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() =>
      hosts
        .first()
        .locator(".grid")
        .evaluate((node) => node.scrollLeft),
    )
    .toBe(0);
  expect(
    await hosts
      .first()
      .locator(".name")
      .first()
      .evaluate((node) => getComputedStyle(node).fontFamily),
  ).toContain("Georgia");
});

test("all six templates preserve public-safe proof and Free attribution", async ({
  page,
}) => {
  await page.route("https://customer.example/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><title>Proof</title></head><body><div id="proof"></div><script src="https://widgets.example/embed/v2.js"></script></body></html>`,
    }),
  );
  await page.goto("https://customer.example/");
  await page.waitForFunction(() => !!window.__getSomeProofEmbedV2);
  for (const layout of [
    "wall",
    "individual",
    "carousel",
    "masonry",
    "highlights",
    "avatars",
  ] as const) {
    const payload = widgetPayload({
      config: { ...config, layout },
      brandName: "Cedar Workshop",
      attributionRequired: true,
      testimonials: (layout === "individual"
        ? testimonials.slice(0, 1)
        : testimonials
      ).map((item) => ({
        ...item,
        avatarVisible: false,
        richText: [
          {
            type: "p" as const,
            children: [{ text: item.text, highlight: true }],
          },
        ],
      })),
    });
    await page.evaluate(
      (payload) =>
        window.__getSomeProofEmbedV2!.renderWidget(
          document.getElementById("proof")!,
          payload,
        ),
      payload,
    );
    await expect(page.locator("#proof [data-gsp-promotion]")).toHaveCount(1);
    await expect(page.locator("#proof .stars")).toHaveCount(0);
    if (layout === "avatars")
      await expect(page.locator("#proof .face")).toHaveCount(0);
    else
      await expect(page.locator("#proof [data-gsp-card]")).toHaveCount(
        layout === "individual" ? 1 : 4,
      );
  }
});
