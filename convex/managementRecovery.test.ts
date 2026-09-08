import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest } from "../tests/convex-test-helpers";

describe("Management recovery admission", () => {
  it("keeps uniform responses without per-target work for unavailable recipients", async () => {
    const t = createConvexTest();
    for (const args of [
      { publicSlug: "missing-studio", email: "visitor@example.com" },
      { publicSlug: "a".repeat(49), email: "visitor@example.com" },
      { publicSlug: "mira-studio", email: "not-an-email" },
    ]) {
      expect(
        await t.action(api.submissionManagement.requestReplacementLink, args),
      ).toEqual({ accepted: true });
    }
    const rows = await t.run(async (ctx) => ({
      requests: await ctx.db
        .query("managementLinkReplacementRequests")
        .collect(),
      buckets: await ctx.db.query("publicReadRateLimitBuckets").collect(),
    }));
    expect(rows.requests).toEqual([]);
    expect(rows.buckets).toEqual([]);
  });
});
