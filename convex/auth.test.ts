import { describe, expect, it } from "vitest";

import { createAuth } from "./auth";

describe("Better Auth configuration", () => {
  it("uses one-time magic links for invitation authentication", () => {
    const auth = createAuth({} as never);

    expect(auth.options.plugins?.map((plugin) => plugin.id)).toContain(
      "magic-link",
    );
  });

  it("signs new users in after email verification so invitation callbacks continue", () => {
    const auth = createAuth({} as never);

    expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(
      true,
    );
  });
});
