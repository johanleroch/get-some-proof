import { describe, expect, it } from "vitest";

import {
  catalogOfferDetails,
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

  it("accepts a historical EUR monthly Pro Price at its Stripe-owned amount", () => {
    expect(
      subscriptionPriceDetails({
        currency: "eur",
        interval: "month",
        unitAmount: 4_900,
      }),
    ).toEqual({ amount: 4_900, currency: "eur", interval: "month" });
  });

  it.each([
    [{ currency: "usd", interval: "month", unitAmount: 2_900 }],
    [{ currency: "eur", interval: "year", unitAmount: 2_900 }],
    [{ currency: "eur", interval: "month", unitAmount: null }],
    [{ currency: "eur", interval: null, unitAmount: 2_900 }],
  ])("refuses a mismatched synchronized Pro Price", (price) => {
    expect(() => subscriptionPriceDetails(price)).toThrow();
  });

  it("projects presentation and amount from one active Stripe Product and Price", () => {
    expect(
      catalogOfferDetails({
        currency: "eur",
        interval: "month",
        lookupKey: "pro_monthly",
        priceActive: true,
        product: {
          active: true,
          description: "Everything needed to collect video proof.",
          marketingFeatures: ["Unlimited text", "25 Ready videos"],
          name: "Proof Pro",
        },
        unitAmount: 4_900,
      }),
    ).toEqual({
      amount: 4_900,
      currency: "eur",
      description: "Everything needed to collect video proof.",
      features: ["Unlimited text", "25 Ready videos"],
      interval: "month",
      name: "Proof Pro",
    });
  });

  it.each([
    [{ priceActive: false, productActive: true }],
    [{ priceActive: true, productActive: false }],
  ])(
    "refuses an inactive Stripe catalog entry",
    ({ priceActive, productActive }) => {
      expect(() =>
        catalogOfferDetails({
          currency: "eur",
          interval: "month",
          lookupKey: "pro_monthly",
          priceActive,
          product: {
            active: productActive,
            description: null,
            marketingFeatures: [],
            name: "Proof Pro",
          },
          unitAmount: 2_900,
        }),
      ).toThrow();
    },
  );
});
