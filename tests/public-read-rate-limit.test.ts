import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import { createConvexTest } from "./convex-test-helpers";

describe("Public Wall read protection", () => {
  beforeEach(() => {
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "test-rate-limit-secret-at-least-32-chars",
    );
  });

  it("counts embed reads independently from product collection quotas", async () => {
    const t = createConvexTest();

    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        resourceKey: "embed:acme-proof",
        secret: "test-rate-limit-secret-at-least-32-chars",
      }),
    ).resolves.toMatchObject({ remaining: 119 });
    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        resourceKey: "embed:acme-proof",
        secret: "test-rate-limit-secret-at-least-32-chars",
      }),
    ).resolves.toMatchObject({ remaining: 118 });
  });

  it("rejects callers without the server-only proof", async () => {
    const t = createConvexTest();

    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        resourceKey: "embed:acme-proof",
        secret: "wrong-secret",
      }),
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_READ_RATE_LIMIT_UNAVAILABLE" },
    });
  });
});
