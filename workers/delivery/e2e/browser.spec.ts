import { test, expect } from "@playwright/test";
import { prepareDeliveryPublication } from "../../../src/lib/cloudflare-delivery";
const origin = "http://127.0.0.1:8790";
const delivery = process.env.CLOUDFLARE_TEST_URL ?? "http://127.0.0.1:8789";
const id = "12345678-1234-4234-8234-123456789abc";
const presentation = {
  config: {
    layout: "masonry" as const,
    font: "inherit" as const,
    accentColor: "#ffbb16",
    backgroundColor: "#ffffff",
    textColor: "#2e2a25",
  },
  brandName: "Cedar Workshop",
  attributionRequired: true,
  testimonials: [
    {
      id: "fixture-proof",
      type: "text" as const,
      name: "Maya Laurent",
      avatarUrl: null,
      publishedAt: 1,
      text: "Our customers can finally see the care behind our work.",
    },
  ],
};

test.beforeAll(async ({ request }) => {
  const envelope = prepareDeliveryPublication(presentation, {
    publicId: id,
    revision: 1,
    policyRevision: 1,
    generatedAt: Date.now(),
    validUntil: Date.now() + 3600000,
    allowedOrigins: [origin],
  });
  const response = await request.put(`${delivery}/__publish/${id}`, {
    headers: {
      Authorization: "Bearer synthetic-canary-browser-secret-32-characters",
    },
    data: envelope,
  });
  expect(response.status()).toBe(201);
});

test("Cloudflare Widget stays readable after 60 seconds with bounded cold/warm requests and application network denied", async ({
  page,
}) => {
  const forbidden: string[] = [];
  const resources: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (![origin, delivery].includes(url.origin)) {
      forbidden.push(url.href);
      await route.abort();
      return;
    }
    if (url.origin === delivery) resources.push(url.pathname);
    await route.continue();
  });
  await page.clock.install();
  for (let read = 0; read < 2; read++) {
    await page.goto(`${origin}/?widget=${id}`);
    await expect(page.getByText("Maya Laurent", { exact: true })).toBeVisible();
    await expect(page.locator("[data-gsp-widget]")).toHaveAttribute(
      "data-gsp-state",
      "ready",
    );
  }
  await expect(
    page.getByRole("link", { name: "Sign up for free" }),
  ).toHaveAttribute(
    "href",
    "https://www.getsomeproof.com/sign-up?utm_source=embedded_wall&utm_medium=referral&utm_campaign=powered_by",
  );
  await page.clock.fastForward(61000);
  await expect(page.getByText("Maya Laurent", { exact: true })).toBeVisible();
  expect(
    resources.filter((path) => path.startsWith("/api/widgets/")),
  ).toHaveLength(2);
  expect(forbidden).toEqual([]);
});

const emptyId = "22345678-1234-4234-8234-123456789abc";
const missingId = "32345678-1234-4234-8234-123456789abc";

test("Cloudflare empty and unavailable Widgets make one bounded request each", async ({
  page,
  request,
}) => {
  const envelope = prepareDeliveryPublication(
    { ...presentation, testimonials: [] },
    {
      publicId: emptyId,
      revision: 1,
      policyRevision: 1,
      generatedAt: Date.now(),
      validUntil: Date.now() + 3600000,
      allowedOrigins: [origin],
    },
  );
  expect(
    (
      await request.put(`${delivery}/__publish/${emptyId}`, {
        headers: {
          Authorization: "Bearer synthetic-canary-browser-secret-32-characters",
        },
        data: envelope,
      })
    ).status(),
  ).toBe(201);
  const forbidden: string[] = [];
  let reads = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (![origin, delivery].includes(url.origin)) {
      forbidden.push(url.href);
      await route.abort();
      return;
    }
    if (url.pathname.startsWith("/api/widgets/")) reads++;
    await route.continue();
  });
  await page.goto(`${origin}/?widget=${emptyId}`);
  await expect(page.locator("[data-gsp-widget]")).toHaveAttribute(
    "data-gsp-state",
    "ready",
  );
  await expect(page.locator("[data-gsp-card]")).toHaveCount(0);
  await page.goto(`${origin}/?widget=${missingId}`);
  await expect(
    page.getByText("Testimonials are currently unavailable."),
  ).toBeVisible();
  expect(reads).toBe(2);
  expect(forbidden).toEqual([]);
});

for (const state of ["content", "empty", "unavailable"] as const) {
  test(`captures Cloudflare Widget ${state}`, async ({
    page,
    request,
  }, testInfo) => {
    const slug = `cloudflare-widget-${state}`;
    test.skip(
      !process.env.VISUAL_EVIDENCE_SLUGS?.split(",").includes(slug),
      "Not selected for visual evidence.",
    );
    if (state === "empty") {
      const envelope = prepareDeliveryPublication(
        { ...presentation, testimonials: [] },
        {
          publicId: emptyId,
          revision: 1,
          policyRevision: 1,
          generatedAt: Date.now(),
          validUntil: Date.now() + 3600000,
          allowedOrigins: [origin],
        },
      );
      expect(
        (
          await request.put(`${delivery}/__publish/${emptyId}`, {
            headers: {
              Authorization:
                "Bearer synthetic-canary-browser-secret-32-characters",
            },
            data: envelope,
          })
        ).status(),
      ).toBe(201);
    }
    await page.goto(
      `${origin}/?widget=${state === "content" ? id : state === "empty" ? emptyId : missingId}`,
    );
    await expect(page.locator("[data-gsp-widget]")).toHaveAttribute(
      "data-gsp-state",
      state === "unavailable" ? "error" : "ready",
    );
    const { mkdir } = await import("node:fs/promises");
    const { resolve, join } = await import("node:path");
    const directory = resolve(
      process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
      testInfo.project.name,
    );
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: join(directory, `${slug}.png`),
      fullPage: true,
      scale: "css",
      animations: "disabled",
    });
  });
}
