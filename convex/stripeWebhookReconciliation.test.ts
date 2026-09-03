import { describe, expect, it } from "vitest";

import { resolvePaymentGraceStart } from "./stripeWebhookReconciliation";

describe("Stripe payment grace reconciliation", () => {
  it("uses only the signed failure for the current latest Invoice", () => {
    expect(
      resolvePaymentGraceStart({
        latestInvoiceId: "in_current",
        paymentFailedAt: 1_790_000_000,
        paymentFailureInvoiceId: "in_current",
        status: "past_due",
      }),
    ).toBe(1_790_000_000);
    expect(
      resolvePaymentGraceStart({
        latestInvoiceId: "in_current",
        paymentFailedAt: 1_780_000_000,
        paymentFailureInvoiceId: "in_previous",
        status: "past_due",
      }),
    ).toBeUndefined();
    expect(
      resolvePaymentGraceStart({
        latestInvoiceId: "in_current",
        paymentFailedAt: 1_790_000_000,
        paymentFailureInvoiceId: "in_current",
        status: "active",
      }),
    ).toBeUndefined();
  });
});
