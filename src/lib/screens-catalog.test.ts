import { describe, expect, it } from "vitest";

import { resolveLivePath, screenSections } from "@/lib/screens-catalog";

const organization = {
  name: "Visual Studio",
  publicSlug: "visual-studio",
  slug: "visual-studio-l5pg",
};

describe("screens catalog", () => {
  it("resolves organization and public slugs for the signed-in Brand", () => {
    expect(resolveLivePath("/org/:organizationSlug/inbox", organization)).toBe(
      "/org/visual-studio-l5pg/inbox",
    );
    expect(resolveLivePath("/c/:publicSlug/privacy", organization)).toBe(
      "/c/visual-studio/privacy",
    );
    expect(resolveLivePath("/sign-in", null)).toBe("/sign-in");
  });

  it("has no live preview without a Brand or for private tokens", () => {
    expect(resolveLivePath("/org/:organizationSlug/dashboard", null)).toBe(
      null,
    );
    expect(resolveLivePath("/s/:token", organization)).toBe(null);
  });

  it("uses unique slugs and fixture routes only", () => {
    const screens = screenSections.flatMap((section) => section.screens);
    const slugs = screens.map((screen) => screen.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const screen of screens) {
      expect(screen.fixturePath ?? "/visual-evidence/").toMatch(
        /^\/visual-evidence\//,
      );
      expect(screen.fixturePath ?? screen.livePath).toBeDefined();
    }
  });
});
