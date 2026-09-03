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

  it("accepts only the exact EUR 29 monthly Pro Price", () => {
    expect(
      subscriptionPriceDetails({
        currency: "eur",
        interval: "month",
        unitAmount: 2_900,
      }),
    ).toEqual({ amount: 2_900, currency: "eur", interval: "month" });
  });

  it.each([
    [{ currency: "usd", interval: "month", unitAmount: 2_900 }],
    [{ currency: "eur", interval: "year", unitAmount: 2_900 }],
    [{ currency: "eur", interval: "month", unitAmount: 4_900 }],
    [{ currency: "eur", interval: null, unitAmount: 2_900 }],
  ])("refuses a mismatched synchronized Pro Price", (price) => {
    expect(() => subscriptionPriceDetails(price)).toThrow();
  });
});
