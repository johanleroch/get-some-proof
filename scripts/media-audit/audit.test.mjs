import { describe, expect, it } from "vitest";
import { classify, referenceQuery } from "./audit.mjs";

describe("media audit", () => {
  it("finds nested references, URLs and pending asset correlation without exporting private fields", async () => {
    const source = referenceQuery("testimonials", null, [
      "image123",
      "play123",
      "pending123",
    ]);
    const run = new Function("ctx", `return (async () => {${source}})()`);
    const ctx = {
      db: {
        query: () => ({
          paginate: async () => ({
            page: [
              {
                _id: "pending123",
                privateEmail: "private@example.test",
                nested: [{ avatar: "image123" }],
                url: "https://stream.mux.com/play123.m3u8",
              },
            ],
            isDone: true,
            continueCursor: "",
          }),
        }),
      },
    };
    const result = await run(ctx);
    expect(result.matches.sort()).toEqual([
      "image123",
      "pending123",
      "play123",
    ]);
    expect(JSON.stringify(result)).not.toContain("private@example.test");
  });
  it("protects referenced and recent files and never certifies Mux ownership", () => {
    const asset = { provider: "convex", tokens: ["id"], createdAt: 10 };
    expect(classify(asset, new Set(["id"]), 20)).toBe("referenced");
    expect(classify(asset, new Set(), 5)).toBe("recent_or_unknown_age");
    expect(classify({ ...asset, createdAt: null }, new Set(), 20)).toBe(
      "recent_or_unknown_age",
    );
    expect(classify(asset, new Set(), 20)).toBe("orphan_candidate");
    expect(classify({ ...asset, provider: "mux" }, new Set(), 20)).toBe(
      "unreferenced_scope_unverified",
    );
  });
});
