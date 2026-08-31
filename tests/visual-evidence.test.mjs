import { describe, expect, it } from "vitest";

import {
  listIssueComments,
  objectKeyFor,
  renderComment,
  validateManifest,
  validateTrustedConfig,
} from "../scripts/visual-evidence/core.mjs";

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
  it("accepts a centralized trusted R2 configuration", () => {
    expect(
      validateTrustedConfig({
        project: "convex-admin-starter",
        bucket: "screenshots",
        endpoint: "https://account.r2.cloudflarestorage.com",
        publicBaseUrl: "https://screenshots.example.com",
        screens: [{ slug: "sign-in" }],
      }).bucket,
    ).toBe("screenshots");
  });
  it("accepts a scoped manifest and creates an immutable object key", () => {
    const validated = validateManifest(manifest, "owner/repository");
    expect(objectKeyFor(validated, validated.screenshots[0])).toBe(
      `convex-admin-starter/pulls/12/${"a".repeat(40)}/desktop-chromium/sign-in.png`,
    );
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
    expect(body).toContain("`aaaaaaa`");
    expect(body).toContain("https://images.example/screen.png");
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
