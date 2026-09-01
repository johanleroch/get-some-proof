import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  startCheckoutHandler,
  type StartCheckoutDependencies,
} from "./billingActions";
import type { BillingProvider } from "./billingService";

describe("startCheckout action orchestration", () => {
  it("runs the complete Owner success path without network credentials", async () => {
    const organizationId = "organization_acme" as Id<"organizations">;
    const provider: BillingProvider = {
      createCheckout: vi.fn().mockResolvedValue({
        sessionId: "cs_server_created",
        url: "https://checkout.stripe.example/server-session",
      }),
      createCustomer: vi.fn().mockResolvedValue({ customerId: "cus_acme" }),
      expireCheckout: vi.fn(),
      findCheckout: vi.fn().mockResolvedValue(null),
      resolveOffer: vi.fn().mockResolvedValue({
        amount: 4_900,
        currency: "eur",
        interval: "month",
        lookupKey: "premium_monthly",
        priceId: "price_server_resolved",
      }),
      retrieveCheckout: vi.fn(),
    };
    const runQuery = vi.fn().mockResolvedValue({
      billingEmail: "accounts@acme.example",
      existingCustomerId: null,
      existingSubscriptions: [],
      organizationId,
      organizationName: "Acme & Co",
      organizationSlug: "acme-and-co",
    });
    const runMutation = vi.fn(
      async (reference: Parameters<ActionCtx["runMutation"]>[0]) => {
        const name = getFunctionName(reference);
        if (name === "billing:reserveCheckout") {
          return {
            leaseId: "lease_acme",
            lookupKey: "premium_monthly" as const,
            reservationId: "reservation_acme",
            stripeCheckoutSessionId: null,
            stripeCustomerId: null,
          };
        }
        return null;
      },
    );
    const dependencies: StartCheckoutDependencies = {
      createProvider: () => provider,
      createReservationId: () => "reservation_acme",
      requireConfiguration: vi.fn(),
      siteUrl: () => "https://app.example",
    };

    await expect(
      startCheckoutHandler(
        { runMutation, runQuery } as unknown as ActionCtx,
        { organizationId, lookupKey: "premium_monthly" },
        dependencies,
      ),
    ).resolves.toEqual({
      url: "https://checkout.stripe.example/server-session",
    });

    expect(runQuery).toHaveBeenCalledWith(expect.objectContaining({}), {
      organizationId,
    });
    expect(provider.createCheckout).toHaveBeenCalledWith({
      cancelUrl:
        "https://app.example/org/acme-and-co/billing?checkout=canceled",
      customerId: "cus_acme",
      idempotencyKey: "reservation_acme",
      metadata: {
        checkoutReservationId: "reservation_acme",
        lookupKey: "premium_monthly",
        orgId: organizationId,
      },
      priceId: "price_server_resolved",
      successUrl:
        "https://app.example/org/acme-and-co/billing?checkout=success",
    });
    expect(runMutation).toHaveBeenCalledWith(expect.objectContaining({}), {
      customerId: "cus_acme",
      leaseId: "lease_acme",
      organizationId,
      reservationId: "reservation_acme",
    });
    expect(runMutation).toHaveBeenLastCalledWith(expect.objectContaining({}), {
      customerId: "cus_acme",
      leaseId: "lease_acme",
      lookupKey: "premium_monthly",
      organizationId,
      reservationId: "reservation_acme",
      sessionId: "cs_server_created",
    });
    expect(
      runMutation.mock.calls.map(([reference]) => getFunctionName(reference)),
    ).toEqual([
      "billing:reserveCheckout",
      "billing:saveCheckoutCustomer",
      "billing:recordCheckoutStarted",
    ]);
    expect(dependencies.requireConfiguration).toHaveBeenCalledOnce();
  });
});
