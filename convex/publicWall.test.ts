import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { createConvexTest } from "../tests/convex-test-helpers";

describe("Public Wall server boundary", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("refuses anonymous and forged credentials before projection lookup", async () => {
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "wall-service-test-credential-32-characters",
    );
    const t = createConvexTest();
    for (const secret of [undefined, "forged"]) {
      await expect(
        t.query(api.publicWall.getBrand, {
          publicSlug: "missing-brand",
          ...(secret ? { secret } : {}),
        }),
      ).rejects.toThrow();
      await expect(
        t.query(api.publicWall.list, {
          publicSlug: "missing-brand",
          paginationOpts: { cursor: null, numItems: 50 },
          ...(secret ? { secret } : {}),
        }),
      ).rejects.toThrow();
    }
  });
  it("bounds page inputs and exposes only a lightweight invalidation signal", async () => {
    const secret = "wall-service-test-credential-32-characters";
    vi.stubEnv("PUBLIC_READ_RATE_LIMIT_SECRET", secret);
    const t = createConvexTest();
    for (const numItems of [0, -1, 51, 1.5]) {
      await expect(
        t.query(api.publicWall.list, {
          secret,
          publicSlug: "missing-brand",
          paginationOpts: { cursor: null, numItems },
        }),
      ).rejects.toThrow("pagination");
    }
    await expect(
      t.query(api.publicWall.list, {
        secret,
        publicSlug: "missing-brand",
        paginationOpts: { cursor: "a".repeat(1025), numItems: 1 },
      }),
    ).rejects.toThrow("pagination");
    await expect(
      t.query(api.publicWall.getBrand, { secret, publicSlug: "missing-brand" }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.publicWall.privacyRevision, { publicSlug: "missing-brand" }),
    ).resolves.toBeNull();
    vi.stubEnv("PUBLIC_READ_RATE_LIMIT_SECRET", "");
    await expect(
      t.query(api.publicWall.getBrand, { secret, publicSlug: "missing-brand" }),
    ).rejects.toThrow();
  });
});
