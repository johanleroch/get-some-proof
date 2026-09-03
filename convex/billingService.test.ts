import { describe, expect, it, vi } from "vitest";

import {
  createOrganizationCheckout,
  listPublicOffers,
  type BillingProvider,
} from "./billingService";

function fakeProvider(): BillingProvider {
  return {
    createCheckout: vi.fn().mockResolvedValue({
      sessionId: "cs_acme",
      url: "https://checkout.stripe.example/session",
    }),
    createCustomer: vi.fn().mockResolvedValue({ customerId: "cus_acme" }),
    createPortalSession: vi.fn().mockResolvedValue({
      url: "https://billing.stripe.example/session",
    }),
    expireCheckout: vi.fn().mockResolvedValue(undefined),
    findCheckout: vi.fn().mockResolvedValue(null),
    resolveOffer: vi.fn().mockResolvedValue({
      amount: 2_900,
      currency: "eur",
      interval: "month",
      lookupKey: "pro_monthly",
      priceId: "price_server_resolved",
    }),
    retrieveCheckout: vi.fn().mockResolvedValue({
      status: "open",
      subscriptionId: null,
      url: "https://checkout.stripe.example/existing-session",
    }),
    retrieveSubscriptionPrice: vi.fn().mockResolvedValue({
      amount: 2_900,
      currency: "eur",
      interval: "month",
    }),
    updateCustomerEmail: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Organization Checkout service", () => {
  it("returns only the allowlisted monthly Pro offer without exposing its Price ID", async () => {
    const provider = fakeProvider();
    vi.mocked(provider.resolveOffer).mockImplementation(async (lookupKey) => ({
      amount: 2_900,
      currency: "eur",
      interval: "month",
      lookupKey,
      priceId: `price_${lookupKey}`,
    }));

    await expect(listPublicOffers(provider)).resolves.toEqual([
      {
        amount: 2_900,
        currency: "eur",
        interval: "month",
        lookupKey: "pro_monthly",
      },
    ]);
    expect(provider.resolveOffer).toHaveBeenCalledOnce();
    expect(provider.resolveOffer).toHaveBeenCalledWith("pro_monthly");
  });

  it("creates one idempotent Organization Customer and uses the server-resolved Price", async () => {
    const provider = fakeProvider();
    const persistCustomer = vi.fn().mockResolvedValue(undefined);
    const persistOffer = vi.fn().mockResolvedValue(undefined);

    const result = await createOrganizationCheckout(provider, {
      billingEmail: "accounts@acme.example",
      cancelUrl: "https://app.example/org/acme/billing?checkout=canceled",
      existingCustomerId: null,
      expectedPriceId: "price_server_resolved",
      existingSessionId: null,
      existingSubscriptions: [],
      lookupKey: "pro_monthly",
      organizationId: "organization_acme",
      organizationName: "Acme",
      persistCustomer,
      persistOffer,
      requestedLookupKey: "pro_monthly",
      reservationId: "reservation_acme",
      successUrl: "https://app.example/org/acme/billing?checkout=success",
    });

    expect(provider.createCustomer).toHaveBeenCalledWith({
      email: "accounts@acme.example",
      idempotencyKey: "organization_acme",
      metadata: { orgId: "organization_acme" },
      name: "Acme",
    });
    expect(provider.createCheckout).toHaveBeenCalledWith({
      cancelUrl: "https://app.example/org/acme/billing?checkout=canceled",
      customerId: "cus_acme",
      idempotencyKey: "reservation_acme",
      metadata: {
        checkoutReservationId: "reservation_acme",
        lookupKey: "pro_monthly",
        orgId: "organization_acme",
      },
      priceId: "price_server_resolved",
      successUrl: "https://app.example/org/acme/billing?checkout=success",
    });
    expect(persistCustomer).toHaveBeenCalledWith("cus_acme");
    expect(persistOffer).toHaveBeenCalledWith("price_server_resolved");
    expect(persistOffer.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(provider.createCheckout).mock.invocationCallOrder[0]!,
    );
    expect(persistCustomer.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(provider.createCheckout).mock.invocationCallOrder[0]!,
    );
    expect(result).toEqual({
      customerId: "cus_acme",
      kind: "ready",
      sessionId: "cs_acme",
      url: "https://checkout.stripe.example/session",
    });
  });

  it("refuses another non-terminal Organization Subscription before external writes", async () => {
    const provider = fakeProvider();

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: null,
        existingSubscriptions: [
          { status: "active", subscriptionId: "sub_active" },
        ],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_acme",
        successUrl: "https://app.example/success",
      }),
    ).rejects.toMatchObject({
      data: { code: "SUBSCRIPTION_ALREADY_EXISTS" },
    });
    expect(provider.resolveOffer).not.toHaveBeenCalled();
    expect(provider.createCustomer).not.toHaveBeenCalled();
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("returns the same open Checkout Session instead of creating another one", async () => {
    const provider = fakeProvider();

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: "cs_existing",
        existingSubscriptions: [],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_acme",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({
      customerId: "cus_existing",
      kind: "ready",
      sessionId: "cs_existing",
      url: "https://checkout.stripe.example/existing-session",
    });
    expect(provider.retrieveCheckout).toHaveBeenCalledWith("cs_existing");
    expect(provider.resolveOffer).not.toHaveBeenCalled();
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("rotates only an expired Checkout Session", async () => {
    const provider = fakeProvider();
    vi.mocked(provider.retrieveCheckout).mockResolvedValue({
      status: "expired",
      subscriptionId: null,
      url: null,
    });

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: "cs_expired",
        existingSubscriptions: [],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_old",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({ kind: "expired" });
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("blocks a completed Session while its Subscription webhook is pending", async () => {
    const provider = fakeProvider();
    vi.mocked(provider.retrieveCheckout).mockResolvedValue({
      status: "complete",
      subscriptionId: "sub_new",
      url: null,
    });

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: "cs_complete",
        existingSubscriptions: [
          { status: "canceled", subscriptionId: "sub_historical" },
        ],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_complete",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({
      customerId: "cus_existing",
      kind: "pending",
      sessionId: "cs_complete",
    });
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("rotates a completed Session only after its own Subscription is terminal", async () => {
    const provider = fakeProvider();
    vi.mocked(provider.retrieveCheckout).mockResolvedValue({
      status: "complete",
      subscriptionId: "sub_complete",
      url: null,
    });

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: "cs_complete",
        existingSubscriptions: [
          { status: "canceled", subscriptionId: "sub_complete" },
        ],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_complete",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({ kind: "expired" });
  });

  it("expires a legacy open Session without a trusted Pro Price mapping", async () => {
    const provider = fakeProvider();

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: null,
        existingSessionId: "cs_monthly",
        existingSubscriptions: [],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_monthly",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({ kind: "expired" });
    expect(provider.expireCheckout).toHaveBeenCalledWith("cs_monthly");
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("recovers a Session created before an ambiguous timeout", async () => {
    const provider = fakeProvider();
    vi.mocked(provider.findCheckout).mockResolvedValue({
      sessionId: "cs_recovered",
      status: "open",
      subscriptionId: null,
      url: "https://checkout.stripe.example/recovered",
    });

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: "cus_existing",
        expectedPriceId: "price_server_resolved",
        existingSessionId: null,
        existingSubscriptions: [],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer: vi.fn(),
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_recovered",
        successUrl: "https://app.example/success",
      }),
    ).resolves.toEqual({
      customerId: "cus_existing",
      kind: "ready",
      sessionId: "cs_recovered",
      url: "https://checkout.stripe.example/recovered",
    });
    expect(provider.findCheckout).toHaveBeenCalledWith(
      "cus_existing",
      "reservation_recovered",
    );
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("persists a newly created Customer before a failed Session can be retried", async () => {
    const provider = fakeProvider();
    const persistCustomer = vi.fn().mockResolvedValue(undefined);
    vi.mocked(provider.createCheckout).mockRejectedValue(
      new Error("ambiguous Stripe timeout"),
    );

    await expect(
      createOrganizationCheckout(provider, {
        billingEmail: "accounts@acme.example",
        cancelUrl: "https://app.example/canceled",
        existingCustomerId: null,
        expectedPriceId: "price_server_resolved",
        existingSessionId: null,
        existingSubscriptions: [],
        lookupKey: "pro_monthly",
        organizationId: "organization_acme",
        organizationName: "Acme",
        persistCustomer,
        persistOffer: vi.fn(),
        requestedLookupKey: "pro_monthly",
        reservationId: "reservation_retryable",
        successUrl: "https://app.example/success",
      }),
    ).rejects.toThrow("ambiguous Stripe timeout");
    expect(persistCustomer).toHaveBeenCalledWith("cus_acme");
  });
});
