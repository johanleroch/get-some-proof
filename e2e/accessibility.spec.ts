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
  "/visual-evidence/studio",
  "/visual-evidence/studio-templates",
  "/visual-evidence/studio-editor",
  "/visual-evidence/studio-preview",
  "/visual-evidence/testimonial-import",
  "/visual-evidence/testimonial-import-url",
  "/visual-evidence/testimonial-import-public",
  "/visual-evidence/testimonial-import-publication",
  "/visual-evidence/testimonial-import-expired",
  "/visual-evidence/testimonial-import-video-failed",
  "/visual-evidence/testimonial-import-video-processing",
  "/visual-evidence/collection-form",
  "/visual-evidence/collection-form-write",
  "/visual-evidence/rich-testimonial",
  "/visual-evidence/collection-form-video",
  "/visual-evidence/collection-form-details",
  "/visual-evidence/testimonial-inbox",
  "/visual-evidence/public-wall",
  "/visual-evidence/billing",
  "/visual-evidence/testimonial-delete",
  "/visual-evidence/workspace-delete",
  "/templates",
  "/templates/masonry-wall",
];

for (const path of canonicalScreens) {
  test(`${path} has no automatic WCAG 2.2 A/AA violation`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expectNoWcagViolations(page);
  });
}

for (const path of [
  "/visual-evidence/testimonial-import",
  "/visual-evidence/testimonial-import-public",
  "/visual-evidence/testimonial-import-publication",
]) {
  test(`${path} retains automatic WCAG contrast in dark mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() =>
      localStorage.setItem("get-some-proof-theme", "dark"),
    );
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expectNoWcagViolations(page);
  });
}

test("Collection Form preserves keyboard focus, validation, and 44px targets", async ({
  page,
}) => {
  const renderErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Maximum update depth|Cannot update a component/.test(message.text())
    )
      renderErrors.push(message.text());
  });
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
  // A small key interval lets Slate and React flush between input events.
  await testimonial.pressSequentially("Too short", { delay: 10 });
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await testimonial.press("ControlOrMeta+A");
  await testimonial.press("Backspace");
  await testimonial.pressSequentially(
    "This deterministic testimonial is long enough to continue safely.",
    { delay: 10 },
  );
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();

  const undersized = await page
    .locator("button:visible, input:visible")
    .evaluateAll((elements) =>
      elements
        // The Next dev overlay ships its own 32px button inside the shadow
        // root of `<nextjs-portal>`, and only exists because e2e runs against
        // `next dev`. `closest` stops at the shadow boundary, so walk the
        // hosts to leave the whole overlay out: it is not our interface.
        .filter((element) => {
          for (
            let node: Node | null = element;
            node;
            node =
              node.getRootNode() instanceof ShadowRoot
                ? (node.getRootNode() as ShadowRoot).host
                : (node as Element).parentElement
          ) {
            if (
              node instanceof Element &&
              node.tagName.toLowerCase().startsWith("nextjs-")
            )
              return false;
          }
          return true;
        })
        .map((element) => {
          // Native and ARIA toggles (Radix checkbox, radio, switch) count
          // their wrapping label as the touch target, like WCAG 2.5.8 allows.
          const isToggle =
            (element instanceof HTMLInputElement &&
              ["checkbox", "radio"].includes(element.type)) ||
            ["checkbox", "radio", "switch"].includes(
              element.getAttribute("role") ?? "",
            );
          const effectiveTarget = isToggle
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
  expect(renderErrors).toEqual([]);
});

test("dark theme destructive text retains AA contrast", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("get-some-proof-theme", "dark");
  });
  await page.goto("/visual-evidence/collection-form");
  await expect(
    page.getByRole("heading", { name: "Share your Fernhill Studio story" }),
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
    ["/visual-evidence/testimonial-delete", "permanent"],
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
            html: '<article class="card video-card" data-gsp-card><div class="video-shell" data-video-aspect-ratio="16:9" style="aspect-ratio:16 / 9"><button aria-label="Play Remy Test\'s testimonial" class="play" data-gsp-play type="button"><img alt="Video from Remy Test" class="poster" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><span class="play-icon">Play</span></button></div><div class="content"><p class="name">Remy Test</p></div></article>',
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
  await expect(player).toHaveAttribute("default-hidden-captions", "");
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

test("Studio selection dialog is accessible for choosing and ordering proof", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual-evidence/studio-editor");
  await page
    .getByRole("button", { name: "Edit selection", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Manage testimonials" }),
  ).toBeVisible();
  await expectNoWcagViolations(page);
  await page.getByRole("tab", { name: "Selected (3)", exact: true }).click();
  await expectNoWcagViolations(page);
});
