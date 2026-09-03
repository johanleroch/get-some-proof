import { ConvexError, v } from "convex/values";

export const premiumLookupKeys = ["premium_monthly", "premium_annual"] as const;

export type PremiumLookupKey = (typeof premiumLookupKeys)[number];

export const premiumLookupKeyValidator = v.union(
  v.literal("premium_monthly"),
  v.literal("premium_annual"),
);

export type ResolvedBillingOffer = {
  amount: number;
  currency: string;
  interval: "month" | "year";
  lookupKey: PremiumLookupKey;
  priceId: string;
};

export type BillingProvider = {
  resolveOffer: (lookupKey: PremiumLookupKey) => Promise<ResolvedBillingOffer>;
  createCustomer: (input: {
    email: string;
    idempotencyKey: string;
    metadata: { orgId: string };
    name: string;
  }) => Promise<{ customerId: string }>;
  createCheckout: (input: {
    cancelUrl: string;
    customerId: string;
    idempotencyKey: string;
    metadata: {
      checkoutReservationId: string;
      lookupKey: PremiumLookupKey;
      orgId: string;
    };
    priceId: string;
    successUrl: string;
  }) => Promise<{ sessionId: string; url: string | null }>;
  createPortalSession: (input: {
    customerId: string;
    mode: "manage" | "payment_method_update";
    returnUrl: string;
  }) => Promise<{ url: string | null }>;
  expireCheckout: (sessionId: string) => Promise<void>;
  findCheckout: (
    customerId: string,
    reservationId: string,
  ) => Promise<CheckoutSnapshot | null>;
  retrieveCheckout: (sessionId: string) => Promise<{
    subscriptionId: string | null;
    status: "complete" | "expired" | "open";
    url: string | null;
  }>;
  retrieveSubscriptionPrice: (priceId: string) => Promise<{
    amount: number;
    currency: string;
    interval: "month" | "year";
  }>;
  updateCustomerEmail: (input: {
    customerId: string;
    email: string;
    idempotencyKey: string;
  }) => Promise<void>;
};

export type CheckoutSnapshot = {
  sessionId: string;
  status: "complete" | "expired" | "open";
  subscriptionId: string | null;
  url: string | null;
};

const terminalSubscriptionStatuses = new Set([
  "canceled",
  "incomplete_expired",
  "unpaid",
]);

export async function listPublicOffers(provider: BillingProvider) {
  const offers = await Promise.all(
    premiumLookupKeys.map((lookupKey) => provider.resolveOffer(lookupKey)),
  );

  return offers.map(({ amount, currency, interval, lookupKey }) => ({
    amount,
    currency,
    interval,
    lookupKey,
  }));
}

export async function createOrganizationCheckout(
  provider: BillingProvider,
  input: {
    billingEmail: string;
    cancelUrl: string;
    existingCustomerId: string | null;
    existingSessionId: string | null;
    existingSubscriptions: Array<{ status: string; subscriptionId: string }>;
    lookupKey: PremiumLookupKey;
    organizationId: string;
    organizationName: string;
    persistCustomer: (customerId: string) => Promise<void>;
    requestedLookupKey: PremiumLookupKey;
    reservationId: string;
    successUrl: string;
  },
) {
  if (
    input.existingSubscriptions.some(
      ({ status }) => !terminalSubscriptionStatuses.has(status),
    )
  ) {
    throw new ConvexError({
      code: "SUBSCRIPTION_ALREADY_EXISTS",
      message:
        "This Organization already has a subscription. Manage it from Billing.",
    });
  }

  let existingSession: CheckoutSnapshot | null = input.existingSessionId
    ? {
        ...(await provider.retrieveCheckout(input.existingSessionId)),
        sessionId: input.existingSessionId,
      }
    : null;
  if (!existingSession && input.existingCustomerId) {
    existingSession = await provider.findCheckout(
      input.existingCustomerId,
      input.reservationId,
    );
  }

  if (existingSession) {
    if (existingSession.status === "complete") {
      const synchronizedSubscription = input.existingSubscriptions.find(
        ({ subscriptionId }) =>
          subscriptionId === existingSession.subscriptionId,
      );
      if (
        synchronizedSubscription &&
        terminalSubscriptionStatuses.has(synchronizedSubscription.status)
      ) {
        return { kind: "expired" as const };
      }
      return {
        kind: "pending" as const,
        customerId: input.existingCustomerId,
        sessionId: existingSession.sessionId,
      };
    }
    if (existingSession.status === "expired") {
      return { kind: "expired" as const };
    }
    if (input.lookupKey !== input.requestedLookupKey) {
      await provider.expireCheckout(existingSession.sessionId);
      return { kind: "expired" as const };
    }
    if (!existingSession.url) {
      throw new ConvexError({
        code: "CHECKOUT_UNAVAILABLE",
        message: "Stripe did not return a hosted Checkout URL.",
      });
    }
    return {
      kind: "ready" as const,
      customerId: input.existingCustomerId,
      sessionId: existingSession.sessionId,
      url: existingSession.url,
    };
  }

  if (input.lookupKey !== input.requestedLookupKey) {
    return { kind: "expired" as const };
  }

  const offer = await provider.resolveOffer(input.lookupKey);
  const customerId =
    input.existingCustomerId ??
    (
      await provider.createCustomer({
        email: input.billingEmail,
        idempotencyKey: input.organizationId,
        metadata: { orgId: input.organizationId },
        name: input.organizationName,
      })
    ).customerId;
  await input.persistCustomer(customerId);
  const session = await provider.createCheckout({
    cancelUrl: input.cancelUrl,
    customerId,
    idempotencyKey: input.reservationId,
    metadata: {
      checkoutReservationId: input.reservationId,
      lookupKey: input.lookupKey,
      orgId: input.organizationId,
    },
    priceId: offer.priceId,
    successUrl: input.successUrl,
  });

  if (!session.url) {
    throw new ConvexError({
      code: "CHECKOUT_UNAVAILABLE",
      message: "Stripe did not return a hosted Checkout URL.",
    });
  }

  return {
    kind: "ready" as const,
    customerId,
    sessionId: session.sessionId,
    url: session.url,
  };
}
