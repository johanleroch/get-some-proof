import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { installRecorderCamera } from "./helpers/recorder-camera";

type VisualEvidenceConfig = {
  project: string;
  screens: Array<{
    slug: string;
    title: string;
    path: string;
    fixturePath?: string;
    heading: string;
    theme?: "light" | "dark";
    requiresAuth?: boolean;
    requiresBackend?: boolean;
  }>;
};

const config = JSON.parse(
  await readFile(
    new URL("../visual-evidence.config.json", import.meta.url),
    "utf8",
  ),
) as VisualEvidenceConfig;

for (const screen of config.screens) {
  test(`captures ${screen.title}`, async ({ page }, testInfo) => {
    const fixtureMode = process.env.VISUAL_EVIDENCE_FIXTURES === "true";
    test.skip(
      Boolean(
        screen.requiresBackend &&
        !fixtureMode &&
        !process.env.NEXT_PUBLIC_CONVEX_URL,
      ),
      "A local Convex backend is required for this visual evidence screen.",
    );
    const configuredOrganizationSlug =
      process.env.VISUAL_EVIDENCE_ORGANIZATION_SLUG;
    const organizationSlug = fixtureMode
      ? (configuredOrganizationSlug ?? "fernhill-studio-l5pg")
      : configuredOrganizationSlug;
    if (screen.requiresAuth && !fixtureMode) {
      const email = process.env.VISUAL_EVIDENCE_EMAIL;
      const password = process.env.VISUAL_EVIDENCE_PASSWORD;
      test.skip(
        !email || !password,
        "Authenticated visual evidence credentials are not configured.",
      );

      await page.goto("/sign-in");
      await page.getByLabel("Email address").fill(email!);
      await page.getByLabel("Password", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));

      test.skip(
        screen.path.includes(":organizationSlug") && !organizationSlug,
        "An Organization slug is required for this visual evidence screen.",
      );
    }

    if (screen.theme) {
      await page.addInitScript((theme) => {
        localStorage.setItem("get-some-proof-theme", theme);
      }, screen.theme);
    }
    if (fixtureMode && screen.slug === "account-security-error") {
      await page.route("**/api/auth/**", async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith("/two-factor/enable")) {
          await route.fulfill({
            status: 403,
            json: { code: "SESSION_NOT_FRESH" },
          });
          return;
        }
        await route.fulfill({
          json: pathname.endsWith("/list-accounts")
            ? [{ providerId: "credential" }]
            : pathname.endsWith("/list-sessions")
              ? []
              : null,
        });
      });
    }
    if (screen.slug.startsWith("recorder-")) {
      const portrait = screen.slug === "recorder-portrait";
      await installRecorderCamera(
        page,
        portrait ? 720 : 1280,
        portrait ? 1280 : 720,
      );
    }
    const destination =
      fixtureMode && screen.fixturePath ? screen.fixturePath : screen.path;
    await page.goto(
      destination.replace(":organizationSlug", organizationSlug ?? ""),
    );
    if (screen.slug === "full-page-loading") {
      await expect(
        page.getByRole("status").getByText("Loading…", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("status").locator("svg")).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: screen.heading, exact: true }),
      ).toBeVisible();
    }
    if (fixtureMode && screen.slug === "account-security-error") {
      await page.getByLabel("Current password").fill("synthetic-password");
      await page.getByRole("button", { name: "Enable 2FA" }).click();
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "This security action needs a recent sign-in.",
      );
    }
    if (screen.slug.startsWith("recorder-")) {
      await page
        .getByRole("button", { name: /Record or upload a video/ })
        .click();
      await page.getByRole("button", { name: "Open camera" }).click();
      await expect
        .poll(() =>
          page
            .getByLabel("Camera preview")
            .evaluate((video: HTMLVideoElement) => video.readyState),
        )
        .toBeGreaterThanOrEqual(2);
    }
    await page.waitForTimeout(250);
    if (screen.slug.startsWith("testimonial-import-identity")) {
      await page
        .getByRole("button", {
          name: "Correct details for Camille Laurent",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (fixtureMode && screen.slug.startsWith("template")) {
      // The gallery is tall and its video posters load lazily: walk the page
      // once so every poster below the fold requests its image.
      await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        window.scrollTo(0, 0);
      });
    }
    if (
      fixtureMode &&
      (screen.slug === "video-thumbnail" ||
        screen.slug.startsWith("testimonial-inbox") ||
        screen.slug.startsWith("template") ||
        (screen.slug.startsWith("public-wall") &&
          screen.slug !== "public-wall-empty"))
    ) {
      await page.waitForFunction(() =>
        [...document.images]
          .filter((image) => image.src.startsWith("https://image.mux.com/"))
          .every((image) => image.complete && image.naturalWidth > 0),
      );
    }
    if (screen.slug === "collection-form-write-long") {
      const editor = page.getByRole("textbox", { name: "Your testimonial" });
      await editor.click();
      await editor.press("ControlOrMeta+End");
      for (let line = 0; line < 12; line++) {
        await editor.press("Enter");
        await editor.pressSequentially("More useful feedback.", { delay: 10 });
      }
      await editor.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.getByRole("heading", { name: "Tell your story" }).click();
    }
    if (screen.slug === "rich-testimonial-highlight") {
      await page
        .getByRole("button", { name: "Highlight a phrase", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (fixtureMode && screen.slug === "testimonial-inbox-player") {
      // The still in the row opens the real card; playback starts from it.
      await page
        .getByRole("button", { name: "Preview Remy Jupille's video" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("button", { name: "Play Remy Jupille's testimonial" })
        .click();
      await expect(page.getByTestId("mux-video-player")).toBeVisible();
      await page.waitForFunction(() => customElements.get("mux-player"));
      const muxPlayer = page
        .getByTestId("mux-video-player")
        .locator("mux-player:not([data-mux-player-react-lazy-placeholder])");
      await expect(muxPlayer).toBeVisible();
      await muxPlayer.dispatchEvent("playing");
      await expect(
        page.getByRole("button", {
          name: "Pause Remy Jupille's testimonial",
        }),
      ).toBeVisible();
    }
    if (fixtureMode && screen.slug === "testimonial-inbox-options") {
      await page
        .getByRole("button", {
          name: "More actions for Remy Jupille's Testimonial",
        })
        .click();
      // The row keeps the decision; the menu holds the tools and the rare acts.
      await expect(
        page.getByRole("menuitem", { name: "Change thumbnail" }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", { name: "Delete permanently" }),
      ).toBeVisible();
    }
    // The mascot tells every toast, so they are custom sonner toasts: assert
    // on the message the visitor reads, not on sonner's own styling hooks.
    if (fixtureMode && screen.slug === "toast-error") {
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "Unable to save your changes. Please try again.",
      );
    }

    if (fixtureMode && screen.slug === "toast-success") {
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "Testimonial permanently deleted.",
      );
    }

    if (screen.slug === "account-project-selector") {
      const switcher = page.getByRole("button", { name: "Switch project" });
      if (!(await switcher.isVisible()))
        await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      await switcher.click();
      await expect(
        page.getByRole("menuitem", { name: "Northwind Coffee" }),
      ).toBeVisible();
    }

    if (screen.slug === "account-deletion-confirmation") {
      await page
        .getByLabel("Type DELETE ACCOUNT to continue")
        .fill("DELETE ACCOUNT");
      await page
        .getByRole("button", { name: "Review account deletion" })
        .click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    }

    if (
      screen.slug === "profile-image" &&
      testInfo.project.name.startsWith("mobile")
    ) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      await expect(
        page.getByRole("link", { name: "Back to project" }),
      ).toBeVisible();
    }
    if (fixtureMode && screen.slug === "workspace-billing") {
      await page
        .getByRole("button", { name: "Annual · 2 months free" })
        .click();
      await page
        .getByRole("heading", { name: "Upgrade to Pro", exact: true })
        .scrollIntoViewIfNeeded();
    }
    if (fixtureMode && screen.slug === "account-invoices") {
      await page
        .getByRole("heading", { name: "Invoices", exact: true })
        .scrollIntoViewIfNeeded();
    }
    if (screen.slug === "testimonial-sources-hidden") {
      await page
        .getByRole("switch", { name: "Show original source logos" })
        .click();
      await page.getByRole("button", { name: "Save Public Wall" }).click();
      await expect(page.locator("[data-gsp-source]")).toHaveCount(0);
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    }
    if (screen.slug === "testimonial-links-disabled") {
      await page
        .getByRole("switch", { name: "Allow links in testimonials" })
        .click();
      await expect(page.locator("blockquote a")).toHaveCount(0);
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    }
    if (fixtureMode && screen.slug.startsWith("testimonial-inbox-bulk")) {
      await page
        .getByRole("checkbox", { name: "Select displayed testimonials" })
        .check();
      await expect(page.getByText("3 selected", { exact: true })).toBeVisible();
      if (screen.slug.endsWith("-delete")) {
        await page
          .getByRole("button", {
            name: testInfo.project.name.startsWith("mobile")
              ? "Actions (3)"
              : "More bulk actions",
            exact: true,
          })
          .click();
        await page
          .getByRole("menuitem", { name: "Delete permanently" })
          .click();
        await expect(
          page.getByRole("dialog", {
            name: "Permanently delete 3 testimonials?",
          }),
        ).toBeVisible();
      }
    }
    const outputRoot = path.resolve(
      process.env.VISUAL_EVIDENCE_DIR ?? "visual-evidence",
    );
    const projectDirectory = path.join(outputRoot, testInfo.project.name);
    await mkdir(projectDirectory, { recursive: true });

    if (screen.slug.startsWith("recorder-")) {
      await page
        .getByLabel("Camera preview")
        .locator("../..")
        .screenshot({
          path: path.join(projectDirectory, `${screen.slug}.png`),
          animations: "disabled",
          scale: "css",
        });
      return;
    }
    await page.screenshot({
      path: path.join(projectDirectory, `${screen.slug}.png`),
      fullPage:
        !screen.slug.startsWith("testimonial-inbox-bulk") &&
        screen.slug !== "rich-testimonial-highlight" &&
        !screen.slug.startsWith("testimonial-import-identity"),
      animations: "disabled",
      caret: "initial",
      scale: "css",
    });
  });
}
