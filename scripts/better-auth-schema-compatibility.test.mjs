import { describe, expect, it } from "vitest";

import { addBetterAuthCompatibilityFields } from "./better-auth-schema-compatibility.mjs";

describe("addBetterAuthCompatibilityFields", () => {
  it("adds the Better Auth 1.6 two-factor lockout fields", () => {
    const adapterSchema = `twoFactor: defineTable({
    secret: v.string(),
    backupCodes: v.string(),
    userId: v.string(),
    verified: v.optional(v.union(v.null(), v.boolean())),
  }).index("userId", ["userId"]),`;

    const compatibleSchema = addBetterAuthCompatibilityFields(adapterSchema);

    expect(compatibleSchema).toContain(
      "failedVerificationCount: v.optional(v.union(v.null(), v.number()))",
    );
    expect(compatibleSchema).toContain(
      "lockedUntil: v.optional(v.union(v.null(), v.number()))",
    );
  });

  it("fails loudly when the pinned adapter schema changes shape", () => {
    expect(() => addBetterAuthCompatibilityFields("export const tables = {}"))
      .toThrowErrorMatchingInlineSnapshot(`
        [Error: Could not extend the Better Auth twoFactor schema: expected anchor not found.]
      `);
  });
});
