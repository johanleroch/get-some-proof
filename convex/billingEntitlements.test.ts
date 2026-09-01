import { describe, expect, it } from "vitest";

import { deriveBillingEntitlement } from "./billingEntitlements";

function subscription(
  status: string,
  cancelAtPeriodEnd = false,
  stripeSubscriptionId = `sub_${status}`,
) {
  return {
    cancelAtPeriodEnd,
    currentPeriodEnd: 1_800_000_000,
    priceId: "price_premium_monthly",
    status,
    stripeSubscriptionId,
  };
}

describe("Organization Billing Entitlement", () => {
  it.each([
    ["active", "active", "premium"],
    ["trialing", "trialing", "premium"],
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
        deriveBillingEntitlement([subscription(stripeStatus)], true),
      ).toMatchObject({ effectivePlan, state });
    },
  );

  it("keeps Premium through cancellation at period end", () => {
    expect(
      deriveBillingEntitlement([subscription("active", true)], true),
    ).toMatchObject({
      effectivePlan: "premium",
      state: "cancellation_scheduled",
    });
  });

  it("normalizes missing and unavailable Billing without granting Premium", () => {
    expect(deriveBillingEntitlement([], true)).toEqual({
      effectivePlan: "free",
      state: "missing",
      subscription: null,
    });
    expect(deriveBillingEntitlement([subscription("active")], false)).toEqual({
      effectivePlan: "free",
      state: "unavailable",
      subscription: null,
    });
  });

  it("selects the Premium Subscription ahead of terminal history", () => {
    expect(
      deriveBillingEntitlement(
        [subscription("canceled"), subscription("past_due")],
        true,
      ),
    ).toMatchObject({
      effectivePlan: "premium",
      state: "past_due",
      subscription: { status: "past_due" },
    });
  });
});
