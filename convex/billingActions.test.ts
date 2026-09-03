import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import {
  getSubscriptionDetailsHandler,
  openPortalHandler,
  startCheckoutHandler,
  updateContactHandler,
  type BillingManagementDependencies,
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
      createPortalSession: vi.fn(),
      expireCheckout: vi.fn(),
      findCheckout: vi.fn().mockResolvedValue(null),
      resolveOffer: vi.fn().mockResolvedValue({
        amount: 2_900,
        currency: "eur",
        interval: "month",
        lookupKey: "pro_monthly",
        priceId: "price_server_resolved",
      }),
      retrieveCheckout: vi.fn(),
      retrieveSubscriptionPrice: vi.fn(),
      updateCustomerEmail: vi.fn(),
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
            expectedProPriceId: null,
            leaseId: "lease_acme",
            lookupKey: "pro_monthly" as const,
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
        { organizationId, lookupKey: "pro_monthly" },
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
        lookupKey: "pro_monthly",
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
      lookupKey: "pro_monthly",
      organizationId,
      reservationId: "reservation_acme",
      sessionId: "cs_server_created",
    });
    expect(
      runMutation.mock.calls.map(([reference]) => getFunctionName(reference)),
    ).toEqual([
      "billing:reserveCheckout",
      "billing:saveCheckoutOffer",
      "billing:saveCheckoutCustomer",
      "billing:recordCheckoutStarted",
    ]);
    expect(dependencies.requireConfiguration).toHaveBeenCalledOnce();
  });
});

function managementProvider(): BillingProvider {
  return {
    createCheckout: vi.fn(),
    createCustomer: vi.fn(),
    createPortalSession: vi.fn().mockResolvedValue({
      url: "https://billing.stripe.example/fresh-session",
    }),
    expireCheckout: vi.fn(),
    findCheckout: vi.fn(),
    resolveOffer: vi.fn(),
    retrieveCheckout: vi.fn(),
    retrieveSubscriptionPrice: vi.fn().mockResolvedValue({
      amount: 2_900,
      currency: "eur",
      interval: "month",
    }),
    updateCustomerEmail: vi.fn(),
  };
}

describe("Billing management action orchestration", () => {
  const organizationId = "organization_acme" as Id<"organizations">;

  function setup(state = "active") {
    const provider = managementProvider();
    const runQuery = vi.fn().mockResolvedValue({
      customerId: "cus_acme",
      organizationId,
      organizationName: "Acme",
      organizationSlug: "acme",
      state,
    });
    const runMutation = vi.fn(
      async (
        reference: Parameters<ActionCtx["runMutation"]>[0],
        args: Record<string, unknown>,
      ) => {
        const name = getFunctionName(reference);
        if (name === "billing:reserveContactUpdate") {
          return {
            customerId: "cus_acme",
            leaseId: "contact_lease_acme",
            transitionId: "contact_transition_acme",
          };
        }
        if (name === "billing:commitContactUpdate") {
          return { email: args.email };
        }
        return null;
      },
    );
    const dependencies: BillingManagementDependencies = {
      createLeaseId: () => "contact_lease_acme",
      createProvider: () => provider,
      createTransitionId: () => "contact_transition_acme",
      requireConfiguration: vi.fn(),
      siteUrl: () => "https://app.example",
    };
    return {
      context: { runMutation, runQuery } as unknown as ActionCtx,
      dependencies,
      provider,
      runMutation,
      runQuery,
    };
  }

  it("creates a fresh management Portal session for every action call", async () => {
    const setupResult = setup();

    await openPortalHandler(
      setupResult.context,
      { mode: "manage", organizationId },
      setupResult.dependencies,
    );
    await openPortalHandler(
      setupResult.context,
      { mode: "manage", organizationId },
      setupResult.dependencies,
    );

    expect(setupResult.provider.createPortalSession).toHaveBeenCalledTimes(2);
    expect(setupResult.provider.createPortalSession).toHaveBeenLastCalledWith({
      customerId: "cus_acme",
      mode: "manage",
      returnUrl: "https://app.example/org/acme/billing",
    });
    expect(setupResult.runMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({}),
      { customerId: "cus_acme", mode: "manage", organizationId },
    );
  });

  it("uses the supported payment-method recovery flow only for past_due", async () => {
    const pastDue = setup("past_due");
    await openPortalHandler(
      pastDue.context,
      { mode: "payment_method_update", organizationId },
      pastDue.dependencies,
    );
    expect(pastDue.provider.createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "payment_method_update" }),
    );

    const active = setup("active");
    await expect(
      openPortalHandler(
        active.context,
        { mode: "payment_method_update", organizationId },
        active.dependencies,
      ),
    ).rejects.toMatchObject({
      data: { code: "PAYMENT_RECOVERY_UNAVAILABLE" },
    });
    expect(active.provider.createPortalSession).not.toHaveBeenCalled();
  });

  it("does not audit or return a missing Portal URL", async () => {
    const setupResult = setup();
    vi.mocked(setupResult.provider.createPortalSession).mockResolvedValue({
      url: null,
    });

    await expect(
      openPortalHandler(
        setupResult.context,
        { mode: "manage", organizationId },
        setupResult.dependencies,
      ),
    ).rejects.toMatchObject({ data: { code: "PORTAL_UNAVAILABLE" } });
    expect(setupResult.runMutation).not.toHaveBeenCalled();
  });

  it("returns the synchronized subscription's exact sanitized Price", async () => {
    const setupResult = setup();
    setupResult.runQuery.mockResolvedValue({ priceId: "price_subscribed" });

    await expect(
      getSubscriptionDetailsHandler(
        setupResult.context,
        { organizationId },
        setupResult.dependencies,
      ),
    ).resolves.toEqual({
      amount: 2_900,
      currency: "eur",
      interval: "month",
    });
    expect(setupResult.provider.retrieveSubscriptionPrice).toHaveBeenCalledWith(
      "price_subscribed",
    );
  });

  it("updates the same Customer before committing the sanitized contact", async () => {
    const setupResult = setup();
    await expect(
      updateContactHandler(
        setupResult.context,
        { email: " Accounts@Acme.Example ", organizationId },
        setupResult.dependencies,
      ),
    ).resolves.toEqual({ email: "accounts@acme.example" });
    expect(setupResult.provider.updateCustomerEmail).toHaveBeenCalledWith({
      customerId: "cus_acme",
      email: "accounts@acme.example",
      idempotencyKey: "billing_contact_contact_transition_acme",
    });
    expect(setupResult.runMutation).toHaveBeenCalledWith(
      expect.objectContaining({}),
      {
        email: "accounts@acme.example",
        expectedCustomerId: "cus_acme",
        leaseId: "contact_lease_acme",
        organizationId,
        transitionId: "contact_transition_acme",
      },
    );
  });

  it("releases the matching reservation without committing after a provider failure", async () => {
    const setupResult = setup();
    vi.mocked(setupResult.provider.updateCustomerEmail).mockRejectedValue(
      new Error("Stripe unavailable"),
    );

    await expect(
      updateContactHandler(
        setupResult.context,
        { email: "accounts@acme.example", organizationId },
        setupResult.dependencies,
      ),
    ).rejects.toThrow("Stripe unavailable");
    expect(
      setupResult.runMutation.mock.calls.map(([reference]) =>
        getFunctionName(reference),
      ),
    ).toEqual(["billing:reserveContactUpdate", "billing:releaseContactUpdate"]);
    expect(setupResult.runMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({}),
      {
        expectedCustomerId: "cus_acme",
        leaseId: "contact_lease_acme",
        organizationId,
        transitionId: "contact_transition_acme",
      },
    );
  });

  it("reuses the Stripe idempotency key after an ambiguous same-contact failure", async () => {
    const setupResult = setup();
    let stableTransitionId: string | null = null;
    setupResult.dependencies.createTransitionId = vi
      .fn()
      .mockReturnValueOnce("contact_transition_first")
      .mockReturnValueOnce("contact_transition_second");
    setupResult.dependencies.createLeaseId = vi
      .fn()
      .mockReturnValueOnce("contact_lease_first")
      .mockReturnValueOnce("contact_lease_second");
    setupResult.runMutation.mockImplementation(async (reference, args) => {
      const name = getFunctionName(reference);
      if (name === "billing:reserveContactUpdate") {
        stableTransitionId ??= String(args.requestedTransitionId);
        return {
          customerId: "cus_acme",
          leaseId: String(args.requestedLeaseId),
          transitionId: stableTransitionId,
        };
      }
      if (name === "billing:commitContactUpdate") {
        return { email: args.email };
      }
      return null;
    });
    vi.mocked(setupResult.provider.updateCustomerEmail)
      .mockRejectedValueOnce(new Error("Ambiguous Stripe timeout"))
      .mockResolvedValueOnce(undefined);

    await expect(
      updateContactHandler(
        setupResult.context,
        { email: "accounts@acme.example", organizationId },
        setupResult.dependencies,
      ),
    ).rejects.toThrow("Ambiguous Stripe timeout");
    await expect(
      updateContactHandler(
        setupResult.context,
        { email: "accounts@acme.example", organizationId },
        setupResult.dependencies,
      ),
    ).resolves.toEqual({ email: "accounts@acme.example" });

    expect(setupResult.provider.updateCustomerEmail).toHaveBeenCalledTimes(2);
    expect(
      vi
        .mocked(setupResult.provider.updateCustomerEmail)
        .mock.calls.map(([call]) => call.idempotencyKey),
    ).toEqual([
      "billing_contact_contact_transition_first",
      "billing_contact_contact_transition_first",
    ]);
  });
});
