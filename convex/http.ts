import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";

import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
registerRoutes(http, components.stripe, {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  onEvent: async (ctx, event) => {
    if (
      event.type !== "customer.subscription.created" &&
      event.type !== "customer.subscription.updated" &&
      event.type !== "customer.subscription.deleted" &&
      event.type !== "invoice.payment_failed"
    ) {
      return;
    }
    const subscriptionId =
      event.type === "invoice.payment_failed"
        ? event.data.object.parent?.subscription_details?.subscription
        : event.data.object.id;
    const normalizedSubscriptionId =
      typeof subscriptionId === "string" ? subscriptionId : subscriptionId?.id;
    if (!normalizedSubscriptionId) return;
    await ctx.runMutation(internal.stripeWebhookSync.enqueueSubscriptionEvent, {
      eventCreated: event.created,
      eventId: event.id,
      eventType: event.type,
      paymentFailureInvoiceId:
        event.type === "invoice.payment_failed"
          ? event.data.object.id
          : undefined,
      paymentFailedAt:
        event.type === "invoice.payment_failed" ? event.created : undefined,
      stripeSubscriptionId: normalizedSubscriptionId,
    });
  },
  webhookPath: "/stripe/webhook",
});

export default http;
