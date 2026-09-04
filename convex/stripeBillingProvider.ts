"use node";

import { StripeSubscriptions } from "@convex-dev/stripe";
import { ConvexError } from "convex/values";
import Stripe from "stripe";

import { components } from "./_generated/api";
import { env, type ActionCtx } from "./_generated/server";
import { type BillingProvider, type ProLookupKey } from "./billingService";
import { isStripeSandboxConfigured } from "./stripeConfiguration";

export const proMonthlyAmount = 2_900;
export const proMonthlyCurrency = "eur";

function offerUnavailable(lookupKey: ProLookupKey): never {
  throw new ConvexError({
    code: "PREMIUM_OFFER_UNAVAILABLE",
    message: `The ${lookupKey} Stripe Price is unavailable or invalid.`,
  });
}

function subscriptionPriceUnavailable(): never {
  throw new ConvexError({
    code: "SUBSCRIPTION_PRICE_UNAVAILABLE",
    message: "The synchronized Stripe Price is unavailable or invalid.",
  });
}

function checkoutSnapshot(session: Stripe.Checkout.Session) {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (session.status === "complete") {
    return {
      sessionId: session.id,
      status: "complete" as const,
      subscriptionId,
      url: session.url,
    };
  }
  if (session.status === "expired") {
    return {
      sessionId: session.id,
      status: "expired" as const,
      subscriptionId,
      url: session.url,
    };
  }
  if (session.status === "open") {
    return {
      sessionId: session.id,
      status: "open" as const,
      subscriptionId,
      url: session.url,
    };
  }
  throw new ConvexError({
    code: "CHECKOUT_UNAVAILABLE",
    message: "Stripe returned an invalid Checkout status.",
  });
}

export function portalSessionParams(input: {
  customerId: string;
  mode: "manage" | "payment_method_update";
  returnUrl: string;
}): Stripe.BillingPortal.SessionCreateParams {
  return {
    customer: input.customerId,
    flow_data:
      input.mode === "payment_method_update"
        ? {
            after_completion: {
              redirect: { return_url: input.returnUrl },
              type: "redirect",
            },
            type: "payment_method_update",
          }
        : undefined,
    return_url: input.returnUrl,
  };
}

export function subscriptionPriceDetails(input: {
  currency: string;
  interval: string | null;
  unitAmount: number | null;
}): {
  amount: number;
  currency: string;
  interval: "month";
} {
  const interval = input.interval;
  if (
    input.unitAmount !== proMonthlyAmount ||
    input.currency !== proMonthlyCurrency ||
    interval !== "month"
  ) {
    subscriptionPriceUnavailable();
  }
  return {
    amount: input.unitAmount,
    currency: input.currency,
    interval,
  };
}

export async function cancelStripeSubscription(
  subscriptionId: string,
  idempotencyKey: string,
) {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new ConvexError({
      code: "BILLING_UNAVAILABLE",
      message: "Stripe Billing is not configured.",
    });
  }
  const stripe = new Stripe(secretKey);
  try {
    await stripe.subscriptions.cancel(subscriptionId, {}, { idempotencyKey });
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code === "resource_missing"
    ) {
      return;
    }
    throw error;
  }
}

export function createStripeBillingProvider(ctx: ActionCtx): BillingProvider {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (
    !secretKey ||
    !isStripeSandboxConfigured({
      secretKey,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    })
  ) {
    throw new ConvexError({
      code: "BILLING_UNAVAILABLE",
      message: "Stripe Billing is not configured.",
    });
  }

  const stripe = new Stripe(secretKey);
  const subscriptions = new StripeSubscriptions(components.stripe, {
    STRIPE_SECRET_KEY: secretKey,
  });

  return {
    async resolveOffer(lookupKey) {
      const prices = await stripe.prices.list({
        active: true,
        limit: 2,
        lookup_keys: [lookupKey],
        type: "recurring",
      });
      if (prices.data.length !== 1) offerUnavailable(lookupKey);
      const price = prices.data[0];
      if (
        !price ||
        price.lookup_key !== lookupKey ||
        price.unit_amount !== proMonthlyAmount ||
        price.currency !== proMonthlyCurrency ||
        price.recurring?.interval !== "month"
      ) {
        offerUnavailable(lookupKey);
      }

      return {
        amount: price.unit_amount,
        currency: price.currency,
        interval: "month",
        lookupKey,
        priceId: price.id,
      };
    },
    createCustomer(input) {
      return subscriptions.createCustomer(ctx, input);
    },
    async createCheckout(input) {
      const result = await stripe.checkout.sessions.create(
        {
          cancel_url: input.cancelUrl,
          client_reference_id: input.metadata.orgId,
          customer: input.customerId,
          line_items: [{ price: input.priceId, quantity: 1 }],
          metadata: input.metadata,
          mode: "subscription",
          subscription_data: { metadata: input.metadata },
          success_url: input.successUrl,
        },
        { idempotencyKey: `organization_checkout_${input.idempotencyKey}` },
      );
      return { sessionId: result.id, url: result.url };
    },
    async createPortalSession(input) {
      const session = await stripe.billingPortal.sessions.create(
        portalSessionParams(input),
      );
      return { url: session.url };
    },
    async expireCheckout(sessionId) {
      await stripe.checkout.sessions.expire(sessionId);
    },
    async findCheckout(customerId, reservationId) {
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
      });
      const session = sessions.data.find(
        ({ metadata }) => metadata?.checkoutReservationId === reservationId,
      );
      return session ? checkoutSnapshot(session) : null;
    },
    async retrieveCheckout(sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const { status, subscriptionId, url } = checkoutSnapshot(session);
      return { status, subscriptionId, url };
    },
    async retrieveSubscriptionPrice(priceId) {
      const price = await stripe.prices.retrieve(priceId);
      return subscriptionPriceDetails({
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
        unitAmount: price.unit_amount,
      });
    },
    async updateCustomerEmail(input) {
      await stripe.customers.update(
        input.customerId,
        { email: input.email },
        { idempotencyKey: input.idempotencyKey },
      );
    },
  };
}
