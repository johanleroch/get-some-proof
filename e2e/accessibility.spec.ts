import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

test.describe.configure({ mode: "serial" });

async function expectNoWcagViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();
  expect(
    violations.map(({ help, id, impact, nodes }) => ({
      help,
      id,
      impact,
      nodes: nodes.map((node) => ({
        failureSummary: node.failureSummary,
        html: node.html,
        target: node.target.join(" "),
      })),
    })),
  ).toEqual([]);
}

const canonicalScreens = [
  "/visual-evidence/collection-form",
  "/visual-evidence/collection-form-video",
  "/visual-evidence/collection-form-details",
  "/visual-evidence/testimonial-inbox",
  "/visual-evidence/public-wall",
  "/visual-evidence/billing",
  "/visual-evidence/testimonial-delete",
  "/visual-evidence/workspace-delete",
];

for (const path of canonicalScreens) {
  test(`${path} has no automatic WCAG 2.2 A/AA violation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expectNoWcagViolations(page);
  });
}

test("Collection Form preserves keyboard focus, validation, and 44px targets", async ({
  page,
}) => {
  await page.goto("/visual-evidence/collection-form");
  const textChoice = page.getByRole("button", {
    name: "Send a text testimonial",
  });
  await textChoice.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Tell your story" }),
  ).toBeVisible();
  const testimonial = page.getByLabel("Your testimonial");
  await expect(testimonial).toBeFocused();
  await testimonial.fill("Too short");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await testimonial.fill(
    "This deterministic testimonial is long enough to continue safely.",
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();

  const undersized = await page
    .locator("button:visible, input:visible")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const effectiveTarget =
            element instanceof HTMLInputElement &&
            ["checkbox", "radio"].includes(element.type)
              ? (element.closest("label") ?? element)
              : element;
          const box = effectiveTarget.getBoundingClientRect();
          return {
            height: box.height,
            label:
              element.getAttribute("aria-label") ??
              element.getAttribute("name") ??
              element.textContent?.trim(),
            width: box.width,
          };
        })
        .filter(({ height, width }) => height < 44 || width < 44),
    );
  expect(undersized).toEqual([]);
});

test("dark theme destructive text retains AA contrast", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("get-some-proof-theme", "dark");
  });
  await page.goto("/visual-evidence/collection-form");
  await expect(
    page.getByRole("heading", { name: "Share your Visual Studio story" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const alert = document.createElement("p");
    alert.className = "text-destructive text-sm";
    alert.textContent = "The submission could not be completed.";
    alert.setAttribute("role", "alert");
    document.querySelector("main")?.prepend(alert);
  });
  await expectNoWcagViolations(page);
});

test("destructive confirmations trap keyboard focus and expose their warning", async ({
  page,
}) => {
  for (const [path, warning] of [
    ["/visual-evidence/testimonial-delete", "cannot be undone"],
    ["/visual-evidence/workspace-delete", "cannot be undone"],
  ] as const) {
    await page.goto(path);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(warning);
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }
});

test("iframe-free embed has accessible alternatives, video controls, and reduced motion", async ({
  baseURL,
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/public-wall/proof-garden*", (route) =>
    route.fulfill({
      body: JSON.stringify({
        brand: {
          accentColor: "#6d5dfc",
          attributionRequired: true,
          name: "Proof Garden",
          publicSlug: "proof-garden",
          theme: "light",
          transparentEmbed: false,
        },
        pagination: { cursor: null },
        schemaVersion: 1,
        testimonials: [
          {
            captionsAvailable: true,
            html: '<article class="card video-card" data-gsp-card><div class="video-shell"><button aria-label="Play Remy Test\'s testimonial" class="play" data-gsp-play type="button"><img alt="Video from Remy Test" class="poster" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><span class="play-icon">Play</span></button></div><div class="content"><p class="name">Remy Test</p></div></article>',
            id: "video-proof",
            name: "Remy Test",
            playbackId: "fake-playback",
            publishedAt: 1,
            type: "video",
          },
        ],
      }),
      contentType: "application/json",
    }),
  );
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head><title>Proof Garden customer proof</title></head>
      <body>
        <main><h1>Customer proof</h1><div data-gsp-wall data-public-slug="proof-garden"></div></main>
        <script src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
      </body>
    </html>
  `);
  const wall = page.locator("[data-gsp-wall]");
  await expect(wall).toHaveAttribute("data-gsp-state", "ready");
  await expect(page.locator("iframe")).toHaveCount(0);
  const play = wall.getByRole("button", {
    name: "Play Remy Test's testimonial",
  });
  await expect(play).toBeVisible();
  await play.click();
  const player = wall.locator("mux-player");
  await expect(player).toHaveAttribute("playback-id", "fake-playback");
  await expect(player).toHaveAttribute("preload", "none");
  await expect(player).not.toHaveAttribute("autoplay", "");
  await expect(player).not.toHaveAttribute("default-hidden-captions", "");
  await expect(player).toHaveAttribute(
    "metadata-video-title",
    "Remy Test's testimonial",
  );
  const transitionDuration = await wall.evaluate(
    (element) =>
      getComputedStyle(element.shadowRoot!.querySelector("article")!)
        .transitionDuration,
  );
  expect(transitionDuration).toBe("0s");
  await expectNoWcagViolations(page);
});
