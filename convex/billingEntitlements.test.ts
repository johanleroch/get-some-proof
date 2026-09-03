import { describe, expect, it } from "vitest";

import { deriveBillingEntitlement } from "./billingEntitlements";

const testNow = 1_790_000_000;

function subscription(
  status: string,
  cancelAtPeriodEnd = false,
  stripeSubscriptionId = `sub_${status}`,
) {
  return {
    cancelAtPeriodEnd,
    currentPeriodEnd: testNow + 30 * 24 * 60 * 60,
    priceId: "price_pro_monthly",
    status,
    statusChangedAt: testNow - 24 * 60 * 60,
    stripeCustomerId: "cus_acme",
    stripeSubscriptionId,
  };
}

const trustedMapping = {
  expectedProPriceId: "price_pro_monthly",
  stripeCustomerId: "cus_acme",
};

describe("Organization Billing Entitlement", () => {
  it.each([
    ["active", "active", "premium"],
    ["trialing", "trialing", "free"],
    ["past_due", "past_due", "premium"],
    ["unpaid", "unpaid", "free"],
    ["canceled", "canceled", "free"],
    ["incomplete", "incomplete", "free"],
    ["incomplete_expired", "incomplete_expired", "free"],
    ["paused", "paused", "free"],
    ["future_status", "inactive", "free"],
  ] as const)(
    "normalizes %s to %s with %s access",
    (stripeStatus, state, effectivePlan) => {
      expect(
        deriveBillingEntitlement(
          [subscription(stripeStatus)],
          true,
          trustedMapping,
          testNow,
        ),
      ).toMatchObject({ effectivePlan, state });
    },
  );

  it("keeps Pro through cancellation at period end", () => {
    expect(
      deriveBillingEntitlement(
        [subscription("active", true)],
        true,
        trustedMapping,
        testNow,
      ),
    ).toMatchObject({
      effectivePlan: "premium",
      state: "cancellation_scheduled",
    });
  });

  it("normalizes missing and unavailable Billing without granting Pro", () => {
    expect(deriveBillingEntitlement([], true, trustedMapping, testNow)).toEqual(
      {
        effectivePlan: "free",
        state: "missing",
        subscription: null,
      },
    );
    expect(
      deriveBillingEntitlement([subscription("active")], false, {}, testNow),
    ).toEqual({
      effectivePlan: "free",
      state: "unavailable",
      subscription: null,
    });
  });

  it("selects the Pro Subscription ahead of terminal history", () => {
    expect(
      deriveBillingEntitlement(
        [subscription("canceled"), subscription("past_due")],
        true,
        trustedMapping,
        testNow,
      ),
    ).toMatchObject({
      effectivePlan: "premium",
      state: "past_due",
      subscription: { status: "past_due" },
    });
  });

  it("selects an eligible past-due grace over an expired active snapshot", () => {
    expect(
      deriveBillingEntitlement(
        [
          { ...subscription("active"), currentPeriodEnd: testNow - 1 },
          subscription("past_due"),
        ],
        true,
        trustedMapping,
        testNow,
      ),
    ).toMatchObject({ effectivePlan: "premium", state: "past_due" });
  });

  it("changes the opaque price revision when Stripe changes the synchronized Price", () => {
    const monthly = deriveBillingEntitlement(
      [subscription("active")],
      true,
      trustedMapping,
      testNow,
    );
    const revised = deriveBillingEntitlement(
      [
        {
          ...subscription("active"),
          priceId: "price_pro_monthly_v2",
        },
      ],
      true,
      { ...trustedMapping, expectedProPriceId: "price_pro_monthly_v2" },
      testNow,
    );

    expect(monthly.subscription?.priceRevision).not.toBe(
      revised.subscription?.priceRevision,
    );
    expect(monthly.subscription?.priceRevision).not.toContain(
      "price_pro_monthly",
    );
  });

  it.each([
    ["customer", { ...trustedMapping, stripeCustomerId: "cus_other" }],
    ["price", { ...trustedMapping, expectedProPriceId: "price_other" }],
  ])("fails closed for a mismatched synchronized %s", (_field, mapping) => {
    expect(
      deriveBillingEntitlement(
        [subscription("active")],
        true,
        mapping,
        testNow,
      ),
    ).toEqual({
      effectivePlan: "free",
      state: "inactive",
      subscription: null,
    });
  });

  it("returns to Free after a scheduled cancellation reaches period end", () => {
    expect(
      deriveBillingEntitlement(
        [
          {
            ...subscription("active", true),
            currentPeriodEnd: testNow,
          },
        ],
        true,
        trustedMapping,
        testNow,
      ),
    ).toMatchObject({ effectivePlan: "free", state: "inactive" });
  });

  it("limits past-due Pro access to the seven-day payment grace", () => {
    const pastDue = subscription("past_due");
    expect(
      deriveBillingEntitlement(
        [pastDue],
        true,
        trustedMapping,
        pastDue.statusChangedAt! + 7 * 24 * 60 * 60 - 1,
      ),
    ).toMatchObject({ effectivePlan: "premium", state: "past_due" });
    expect(
      deriveBillingEntitlement(
        [pastDue],
        true,
        trustedMapping,
        pastDue.statusChangedAt! + 7 * 24 * 60 * 60,
      ),
    ).toMatchObject({ effectivePlan: "free", state: "inactive" });
  });
});
