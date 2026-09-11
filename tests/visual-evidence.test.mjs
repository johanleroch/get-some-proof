import { describe, expect, it } from "vitest";

import {
  isCaptureViewport,
  listIssueComments,
  renderComment,
  validateManifest,
  validateTrustedConfig,
} from "../scripts/visual-evidence/core.mjs";
import { selectVisualEvidenceScreens } from "../scripts/visual-evidence/select.mjs";

const manifest = {
  schemaVersion: 1,
  repository: "owner/repository",
  project: "convex-admin-starter",
  target: { kind: "pull", number: 12 },
  headSha: "a".repeat(40),
  runId: "42",
  screenshots: [
    {
      path: "desktop-chromium/sign-in.png",
      title: "Sign in",
      viewport: "desktop-chromium",
    },
  ],
};

describe("visual evidence artifact contract", () => {
  it("accepts a centralized screenshot configuration", () => {
    expect(
      validateTrustedConfig({
        project: "convex-admin-starter",
        screens: [{ slug: "sign-in", title: "Sign in" }],
      }).project,
    ).toBe("convex-admin-starter");
  });

  it("rejects unsafe screenshot titles before capture", () => {
    expect(() =>
      validateTrustedConfig({
        project: "convex-admin-starter",
        screens: [{ slug: "sign-in-dark", title: "Sign in — dark" }],
      }),
    ).toThrow(/Invalid screenshot title/);
  });
  it("rejects unsafe screenshot slugs before workflow output", () => {
    expect(() =>
      validateTrustedConfig({
        project: "convex-admin-starter",
        screens: [{ slug: "bad\noutput=x", title: "Sign in" }],
      }),
    ).toThrow(/screenshot slug/);
  });
  it("rejects repository mismatches and path traversal", () => {
    expect(() => validateManifest(manifest, "another/repository")).toThrow(
      /repository/,
    );
    expect(() =>
      validateManifest(manifest, "owner/repository", "another-project"),
    ).toThrow(/trusted configuration/);
    expect(() =>
      validateManifest(
        {
          ...manifest,
          screenshots: [{ ...manifest.screenshots[0], path: "../secret.png" }],
        },
        "owner/repository",
      ),
    ).toThrow(/Unsafe screenshot path/);
    expect(() =>
      validateManifest(
        {
          ...manifest,
          screenshots: [
            { ...manifest.screenshots[0], title: "[click me](javascript:x)" },
          ],
        },
        "owner/repository",
      ),
    ).toThrow(/Invalid screenshot title/);
  });

  it("renders one replaceable PR comment with the commit and image", () => {
    const body = renderComment(manifest, [
      { ...manifest.screenshots[0], url: "https://images.example/screen.png" },
    ]);
    expect(body).toContain("<!-- visual-evidence:convex-admin-starter -->");
    expect(body).toContain(`\`${"a".repeat(40)}\``);
    expect(body).toContain("https://images.example/screen.png");
  });

  it("renders an explicit empty state instead of an old screenshot gallery", () => {
    const body = renderComment({ ...manifest, screenshots: [] }, []);
    expect(body).toContain("Aucun rendu UI modifié");
    expect(body).not.toContain("images.example");
    expect(() =>
      validateManifest({ ...manifest, screenshots: [] }, "owner/repository"),
    ).not.toThrow();
  });

  it("searches every comment page before deciding whether to create one", async () => {
    const calls = [];
    const comments = await listIssueComments(
      async (pathname) => {
        calls.push(pathname);
        return calls.length === 1
          ? Array.from({ length: 100 }, (_, id) => ({ id }))
          : [
              {
                id: 100,
                body: "<!-- visual-evidence:convex-admin-starter -->",
              },
            ];
      },
      "owner",
      "repository",
      12,
    );
    expect(comments).toHaveLength(101);
    expect(calls).toHaveLength(2);
  });
});

describe("visual evidence screen selection", () => {
  const config = {
    project: "get-some-proof",
    screens: [
      { slug: "overview-loading", title: "Overview loading shell" },
      { slug: "inbox-loading", title: "Inbox loading shell" },
      { slug: "studio-loading", title: "Studio loading shell" },
    ],
  };

  it("selects only the declared screens and removes duplicates", () => {
    expect(
      selectVisualEvidenceScreens(
        "<!-- visual-evidence-screens: overview-loading, studio-loading, overview-loading -->",
        config,
      ),
    ).toEqual(["overview-loading", "studio-loading"]);
  });

  it("supports an explicit no-visual-change selection", () => {
    expect(
      selectVisualEvidenceScreens(
        "<!-- visual-evidence-screens: none -->",
        config,
      ),
    ).toEqual([]);
  });

  it("rejects missing, duplicate, and unknown selections", () => {
    expect(() => selectVisualEvidenceScreens("", config)).toThrow(
      /exactly one/,
    );
    expect(() =>
      selectVisualEvidenceScreens(
        "<!-- visual-evidence-screens: none -->\n<!-- visual-evidence-screens: studio-loading -->",
        config,
      ),
    ).toThrow(/exactly one/);
    expect(() =>
      selectVisualEvidenceScreens(
        "<!-- visual-evidence-screens: unknown -->",
        config,
      ),
    ).toThrow(/Unknown visual evidence screens/);
  });
});

describe("capture viewports", () => {
  it("keeps only the folders Playwright writes, never the hand-made ones", () => {
    expect(isCaptureViewport("desktop-chromium")).toBe(true);
    expect(isCaptureViewport("mobile-webkit")).toBe(true);
    expect(isCaptureViewport("manual")).toBe(false);
    expect(isCaptureViewport("desktop")).toBe(false);
    expect(isCaptureViewport("Desktop-Chromium")).toBe(false);
    expect(isCaptureViewport(undefined)).toBe(false);
  });
});
