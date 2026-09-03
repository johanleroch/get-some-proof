import { describe, expect, it } from "vitest";

import { isStripeSandboxConfigured } from "./stripeConfiguration";

describe("Stripe sandbox configuration", () => {
  it("accepts only a test secret key with a webhook secret", () => {
    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(true);

    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_live_must_stay_disabled",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: undefined,
      }),
    ).toBe(false);
    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: "not-a-signing-secret",
      }),
    ).toBe(false);
    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_test_ ",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
    expect(
      isStripeSandboxConfigured({
        secretKey: "sk_test_x",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
  });
});
