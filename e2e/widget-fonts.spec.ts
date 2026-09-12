import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { widgetPayload } from "../src/components/studio/widget-payload";

test("Pro can search Google Fonts and return to the website font", async ({
  page,
}, testInfo) => {
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({
      contentType: "text/css",
      body: '@font-face { font-family: "Figtree"; src: url("https://fonts.gstatic.com/test-figtree.woff2") format("woff2"); font-style: normal; font-weight: 400; }',
    }),
  );
  await page.route(
    "https://fonts.gstatic.com/test-figtree.woff2",
    async (route) =>
      route.fulfill({
        contentType: "font/woff2",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: await readFile("src/components/chatgpt/fonts/figtree-0.woff2"),
      }),
  );
  await page.goto("/kit/studio");
  await expect(
    page.getByRole("combobox", { name: "Font", exact: true }),
  ).toContainText("Match your website");
  await page.getByRole("combobox", { name: "Font", exact: true }).click();
  await page.getByRole("option", { name: "Google Fonts", exact: true }).click();
  await page.getByRole("button", { name: "Google font", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search Google Fonts" })
    .fill("Figtree");
  await expect(
    page.getByRole("button", { name: "Figtree", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("google-font-search.png"),
    animations: "disabled",
    scale: "css",
  });
  await page.getByRole("button", { name: "Figtree", exact: true }).click();
  await expect(page.locator("[data-widget-preview]")).toHaveCSS(
    "font-family",
    /Figtree/,
  );
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (face) =>
          face.family.replaceAll('"', "") === "Figtree" &&
          face.status === "loaded",
      ),
    ),
  ).toBe(true);
  await page.getByRole("combobox", { name: "Font", exact: true }).click();
  await page
    .getByRole("option", { name: "Match your website", exact: true })
    .click();
  expect(
    await page
      .locator("[data-widget-preview]")
      .evaluate((host) => host.style.fontFamily),
  ).toBe("inherit");
});

test("loads a custom font in the embed and restores fallback after removal", async ({
  page,
}) => {
  await page.route("https://customer.example/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><head><title>Font check</title></head><body><div id=proof></div></body></html>",
    }),
  );
  await page.route("https://fonts.example/figtree.woff2", async (route) =>
    route.fulfill({
      contentType: "font/woff2",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: await readFile("src/components/chatgpt/fonts/figtree-0.woff2"),
    }),
  );
  await page.goto("https://customer.example/");
  await page.addScriptTag({
    content: await readFile("public/embed/v2.js", "utf8"),
  });
  const payload = widgetPayload({
    config: {
      layout: "masonry",
      font: "serif",
      accentColor: "#ffbb16",
      backgroundColor: "#ffffff",
      textColor: "#222222",
    },
    customFont: { id: "testfont", url: "https://fonts.example/figtree.woff2" },
    brandName: "Cedar Workshop",
    attributionRequired: false,
    testimonials: [],
  });
  await page.evaluate(
    (payload) =>
      window.__getSomeProofEmbedV2!.renderWidget(
        document.getElementById("proof")!,
        payload,
      ),
    payload,
  );
  await expect(page.locator("#proof")).toHaveCSS(
    "font-family",
    /gsp-custom-testfont/,
  );
  expect(
    await page.evaluate(() => document.fonts.check("16px gsp-custom-testfont")),
  ).toBe(true);
  await page.evaluate(
    (payload) =>
      window.__getSomeProofEmbedV2!.renderWidget(
        document.getElementById("proof")!,
        { ...payload, customFont: null },
      ),
    payload,
  );
  await expect(page.locator("#proof")).toHaveCSS(
    "font-family",
    "Georgia, serif",
  );
});

test("imports a real WOFF2 in Studio and previews it", async ({
  page,
}, testInfo) => {
  await page.goto("/kit/studio");
  await page.getByRole("combobox", { name: "Font", exact: true }).click();
  await page.getByRole("option", { name: "Custom font", exact: true }).click();
  await page
    .getByLabel("Upload custom font")
    .setInputFiles("src/components/chatgpt/fonts/figtree-0.woff2");
  await expect(
    page.getByRole("combobox", { name: "Custom font", exact: true }),
  ).toContainText("figtree-0");
  await page
    .getByRole("button", { name: "Upload font", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("custom-font-control.png"),
    animations: "disabled",
    scale: "css",
  });
  // The mobile editor has separate edit and preview panels.
  const preview = page.getByRole("button", {
    name: "Preview widget",
    exact: true,
  });
  if (await preview.isVisible()) await preview.click();
  await expect(page.locator("[data-widget-preview]")).toHaveCSS(
    "font-family",
    /gsp-custom-fixturefont1/,
  );
  await page.screenshot({
    path: testInfo.outputPath("custom-font-preview.png"),
    animations: "disabled",
    scale: "css",
  });
});
