"use node";

import Stripe from "stripe";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { isStripeSandboxConfigured } from "./stripeConfiguration";

export function resolvePaymentGraceStart(input: {
  latestInvoiceId?: string;
  paymentFailedAt?: number;
  paymentFailureInvoiceId?: string;
  status: string;
}) {
  return input.status === "past_due" &&
    input.latestInvoiceId &&
    input.paymentFailureInvoiceId === input.latestInvoiceId
    ? input.paymentFailedAt
    : undefined;
}

export const reconcileSubscription = internalAction({
  args: {
    attempt: v.number(),
    generation: v.number(),
    stripeSubscriptionId: v.string(),
  },
  returns: v.object({
    outcome: v.union(v.literal("applied"), v.literal("superseded")),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ outcome: "applied" | "superseded" }> => {
    try {
      const request = await ctx.runQuery(
        internal.stripeWebhookSync.readReconciliationRequest,
        { stripeSubscriptionId: args.stripeSubscriptionId },
      );
      if (!request || request.generation !== args.generation) {
        return { outcome: "superseded" as const };
      }
      if (
        !isStripeSandboxConfigured({
          secretKey: env.STRIPE_SECRET_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        })
      ) {
        throw new Error("Stripe sandbox Billing is not configured.");
      }
      const stripe = new Stripe(env.STRIPE_SECRET_KEY!);
      const subscription = await stripe.subscriptions.retrieve(
        args.stripeSubscriptionId,
        { expand: ["latest_invoice"] },
      );
      const item = subscription.items.data[0];
      const stripeCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const latestInvoice =
        subscription.latest_invoice &&
        typeof subscription.latest_invoice !== "string"
          ? subscription.latest_invoice
          : null;
      const paymentFailure = latestInvoice
        ? await ctx.runQuery(
            internal.stripeWebhookSync.readInvoicePaymentFailure,
            { stripeInvoiceId: latestInvoice.id },
          )
        : null;
      const result = await ctx.runMutation(
        internal.stripeWebhookSync.applySubscriptionEvent,
        {
          cancelAt: subscription.cancel_at ?? undefined,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: item?.current_period_end ?? 0,
          eventCreated: request.latestEventCreated,
          eventId: `reconcile:${request.latestEventId}:${args.generation}`,
          eventType: "stripe.subscription.reconciled",
          organizationId: subscription.metadata.orgId,
          priceId: item?.price.id ?? "",
          providerGeneration: args.generation,
          providerObservedAt: Date.now(),
          requiredReconciliationGeneration: args.generation,
          status: subscription.status,
          statusChangedAt: resolvePaymentGraceStart({
            latestInvoiceId: latestInvoice?.id,
            paymentFailedAt:
              paymentFailure?.stripeSubscriptionId === subscription.id
                ? paymentFailure.firstFailedAt
                : undefined,
            paymentFailureInvoiceId: paymentFailure?.stripeInvoiceId,
            status: subscription.status,
          }),
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
        },
      );
      return {
        outcome:
          result.outcome === "applied"
            ? ("applied" as const)
            : ("superseded" as const),
      };
    } catch (error) {
      await ctx.runMutation(
        internal.stripeWebhookSync.recordReconciliationFailure,
        {
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Stripe reconciliation failed.",
          generation: args.generation,
          stripeSubscriptionId: args.stripeSubscriptionId,
        },
      );
      return { outcome: "superseded" as const };
    }
  },
});
