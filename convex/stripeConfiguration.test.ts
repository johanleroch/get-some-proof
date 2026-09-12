import { describe, expect, it } from "vitest";

import { isStripeConfigured } from "./stripeConfiguration";

describe("Stripe configuration", () => {
  it("defaults to test mode and requires valid secrets", () => {
    expect(
      isStripeConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(true);

    expect(
      isStripeConfigured({
        secretKey: "sk_live_must_stay_disabled",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
    expect(
      isStripeConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: undefined,
      }),
    ).toBe(false);
    expect(
      isStripeConfigured({
        secretKey: "sk_test_get_some_proof",
        webhookSecret: "not-a-signing-secret",
      }),
    ).toBe(false);
    expect(
      isStripeConfigured({
        secretKey: "sk_test_ ",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
    expect(
      isStripeConfigured({
        secretKey: "sk_test_x",
        webhookSecret: "whsec_get_some_proof",
      }),
    ).toBe(false);
  });
  it("accepts live keys only with explicit live mode", () => {
    expect(
      isStripeConfigured({
        mode: "live",
        secretKey: "sk_live_example",
        webhookSecret: "whsec_example",
      }),
    ).toBe(true);
    for (const mode of [undefined, "test", "invalid", ""]) {
      expect(
        isStripeConfigured({
          mode,
          secretKey: "sk_live_example",
          webhookSecret: "whsec_example",
        }),
      ).toBe(false);
    }
    expect(
      isStripeConfigured({
        mode: "live",
        secretKey: "sk_test_example",
        webhookSecret: "whsec_example",
      }),
    ).toBe(false);
    expect(
      isStripeConfigured({ mode: "live", secretKey: "sk_live_example" }),
    ).toBe(false);
  });
});
