"use node";

import { randomUUID } from "node:crypto";

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env, type ActionCtx } from "./_generated/server";
import {
  createOrganizationCheckout,
  listPublicOffers,
  type BillingProvider,
  type PremiumLookupKey,
  premiumLookupKeyValidator,
} from "./billingService";
import { createStripeBillingProvider } from "./stripeBillingProvider";

const publicOfferValidator = v.object({
  amount: v.number(),
  currency: v.string(),
  interval: v.union(v.literal("month"), v.literal("year")),
  lookupKey: premiumLookupKeyValidator,
});

function requireStripeConfiguration() {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new ConvexError({
      code: "BILLING_UNAVAILABLE",
      message: "Stripe Billing is not configured.",
    });
  }
}

export type StartCheckoutDependencies = {
  createProvider: (ctx: ActionCtx) => BillingProvider;
  createReservationId: () => string;
  requireConfiguration: () => void;
  siteUrl: () => string;
};

type CheckoutContext = {
  billingEmail: string;
  existingCustomerId: string | null;
  existingSubscriptions: Array<{ status: string; subscriptionId: string }>;
  organizationId: Id<"organizations">;
  organizationName: string;
  organizationSlug: string;
};

type CheckoutReservation = {
  leaseId: string;
  lookupKey: PremiumLookupKey;
  reservationId: string;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
};

type CheckoutResult = Awaited<ReturnType<typeof createOrganizationCheckout>>;

const productionCheckoutDependencies: StartCheckoutDependencies = {
  createProvider: createStripeBillingProvider,
  createReservationId: randomUUID,
  requireConfiguration: requireStripeConfiguration,
  siteUrl: () => env.SITE_URL,
};

export const getOffers = action({
  args: { organizationId: v.id("organizations") },
  returns: v.array(publicOfferValidator),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.billing.requireOfferAccess, args);
    requireStripeConfiguration();
    return listPublicOffers(createStripeBillingProvider(ctx));
  },
});

export async function startCheckoutHandler(
  ctx: ActionCtx,
  args: {
    organizationId: Id<"organizations">;
    lookupKey: PremiumLookupKey;
  },
  dependencies: StartCheckoutDependencies = productionCheckoutDependencies,
): Promise<{ url: string }> {
  const checkoutContext: CheckoutContext = await ctx.runQuery(
    internal.billing.getCheckoutContext,
    { organizationId: args.organizationId },
  );
  dependencies.requireConfiguration();
  const billingUrl = new URL(
    `/org/${encodeURIComponent(checkoutContext.organizationSlug)}/billing`,
    dependencies.siteUrl(),
  );
  const successUrl = new URL(billingUrl);
  successUrl.searchParams.set("checkout", "success");
  const cancelUrl = new URL(billingUrl);
  cancelUrl.searchParams.set("checkout", "canceled");
  let reservation: CheckoutReservation = await ctx.runMutation(
    internal.billing.reserveCheckout,
    {
      billingEmail: checkoutContext.billingEmail,
      lookupKey: args.lookupKey,
      organizationId: checkoutContext.organizationId,
      requestedReservationId: dependencies.createReservationId(),
    },
  );
  const provider = dependencies.createProvider(ctx);

  async function createForReservation(): Promise<CheckoutResult> {
    return createOrganizationCheckout(provider, {
      ...checkoutContext,
      cancelUrl: cancelUrl.toString(),
      existingCustomerId: reservation.stripeCustomerId,
      existingSessionId: reservation.stripeCheckoutSessionId,
      existingSubscriptions: checkoutContext.existingSubscriptions,
      lookupKey: reservation.lookupKey,
      organizationId: String(checkoutContext.organizationId),
      persistCustomer: async (customerId) => {
        await ctx.runMutation(internal.billing.saveCheckoutCustomer, {
          customerId,
          leaseId: reservation.leaseId,
          organizationId: checkoutContext.organizationId,
          reservationId: reservation.reservationId,
        });
      },
      requestedLookupKey: args.lookupKey,
      reservationId: reservation.reservationId,
      successUrl: successUrl.toString(),
    });
  }

  let result: CheckoutResult = await createForReservation();
  if (result.kind === "expired") {
    reservation = await ctx.runMutation(
      internal.billing.rotateExpiredCheckout,
      {
        expectedLeaseId: reservation.leaseId,
        expectedReservationId: reservation.reservationId,
        lookupKey: args.lookupKey,
        organizationId: checkoutContext.organizationId,
        requestedReservationId: dependencies.createReservationId(),
      },
    );
    result = await createForReservation();
  }
  if (
    (result.kind !== "ready" && result.kind !== "pending") ||
    !result.customerId
  ) {
    throw new ConvexError({
      code: "CHECKOUT_UNAVAILABLE",
      message: "Stripe Checkout could not be prepared.",
    });
  }

  await ctx.runMutation(internal.billing.recordCheckoutStarted, {
    customerId: result.customerId,
    leaseId: reservation.leaseId,
    lookupKey: reservation.lookupKey,
    organizationId: checkoutContext.organizationId,
    reservationId: reservation.reservationId,
    sessionId: result.sessionId,
  });

  if (result.kind === "pending") {
    throw new ConvexError({
      code: "SUBSCRIPTION_ALREADY_EXISTS",
      message:
        "Checkout is complete and the subscription is being synchronized.",
    });
  }

  return { url: result.url };
}

export const startCheckout = action({
  args: {
    organizationId: v.id("organizations"),
    lookupKey: premiumLookupKeyValidator,
  },
  returns: v.object({ url: v.string() }),
  handler: (ctx, args): Promise<{ url: string }> =>
    startCheckoutHandler(ctx, args),
});
