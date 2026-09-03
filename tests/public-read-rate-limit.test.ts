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
        publicSlug: "acme-proof",
        requesterKey: "11111111111111111111111111111111",
        secret: "test-rate-limit-secret-at-least-32-chars",
      }),
    ).resolves.toMatchObject({ remaining: 29 });
    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        publicSlug: "acme-proof",
        requesterKey: "11111111111111111111111111111111",
        secret: "test-rate-limit-secret-at-least-32-chars",
      }),
    ).resolves.toMatchObject({ remaining: 28 });
  });

  it("isolates one requester's limit from other public visitors", async () => {
    const t = createConvexTest();
    const args = {
      publicSlug: "acme-proof",
      requesterKey: "11111111111111111111111111111111",
      secret: "test-rate-limit-secret-at-least-32-chars",
    };

    for (let index = 0; index < 30; index += 1) {
      await t.mutation(api.publicReadRateLimit.consume, args);
    }
    await expect(
      t.mutation(api.publicReadRateLimit.consume, args),
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_READ_RATE_LIMITED" },
    });
    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        ...args,
        requesterKey: "22222222222222222222222222222222",
      }),
    ).resolves.toMatchObject({ remaining: 29 });
  });

  it("rejects callers without the server-only proof", async () => {
    const t = createConvexTest();

    await expect(
      t.mutation(api.publicReadRateLimit.consume, {
        publicSlug: "acme-proof",
        requesterKey: "11111111111111111111111111111111",
        secret: "wrong-secret",
      }),
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_READ_RATE_LIMIT_UNAVAILABLE" },
    });
  });
});
