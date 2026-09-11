import { expect, it } from "vitest";

import { components } from "../convex/_generated/api";
import { createConvexTest } from "./convex-test-helpers";

it("stores the verification lockout state created during two-factor setup", async () => {
  const t = createConvexTest();
  const lockedUntil = Date.now() + 60_000;

  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "twoFactor",
      data: {
        backupCodes: "encrypted-backup-codes",
        failedVerificationCount: 0,
        lockedUntil,
        secret: "encrypted-totp-secret",
        userId: "two-factor-owner",
        verified: false,
      },
    },
  });

  await expect(
    t.query(components.betterAuth.adapter.findOne, {
      model: "twoFactor",
      where: [{ field: "userId", value: "two-factor-owner" }],
    }),
  ).resolves.toMatchObject({
    failedVerificationCount: 0,
    lockedUntil,
    userId: "two-factor-owner",
    verified: false,
  });
});
