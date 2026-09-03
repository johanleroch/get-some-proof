import { describe, expect, it } from "vitest";

import {
  portalSessionParams,
  subscriptionPriceDetails,
} from "./stripeBillingProvider";

describe("Stripe Billing provider port", () => {
  it("creates a normal fresh Customer Portal session without a forced flow", () => {
    expect(
      portalSessionParams({
        customerId: "cus_acme",
        mode: "manage",
        returnUrl: "https://app.example/org/acme/billing",
      }),
    ).toEqual({
      customer: "cus_acme",
      flow_data: undefined,
      return_url: "https://app.example/org/acme/billing",
    });
  });

  it("uses Stripe's payment_method_update recovery deep link", () => {
    expect(
      portalSessionParams({
        customerId: "cus_acme",
        mode: "payment_method_update",
        returnUrl: "https://app.example/org/acme/billing",
      }),
    ).toEqual({
      customer: "cus_acme",
      flow_data: {
        after_completion: {
          redirect: {
            return_url: "https://app.example/org/acme/billing",
          },
          type: "redirect",
        },
        type: "payment_method_update",
      },
      return_url: "https://app.example/org/acme/billing",
    });
  });

  it("sanitizes the exact synchronized Price instead of today's offer", () => {
    expect(
      subscriptionPriceDetails({
        currency: "eur",
        interval: "year",
        unitAmount: 41_000,
      }),
    ).toEqual({ amount: 41_000, currency: "eur", interval: "year" });
  });

  it("refuses a synchronized non-recurring Price", () => {
    expect(() =>
      subscriptionPriceDetails({
        currency: "eur",
        interval: null,
        unitAmount: 100,
      }),
    ).toThrow();
  });
});
