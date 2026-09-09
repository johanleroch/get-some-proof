import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";

import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { muxWebhook } from "./muxWebhook";
import {
  importOAuthHttp,
  importOAuthMetadata,
  importDestinationsHttp,
  importSaveHttp,
  importStatusHttp,
  importRetryHttp,
  importEligibilityHttp,
} from "./importOAuth";

const http = httpRouter();

http.route({ method: "POST", path: "/mux/webhook", handler: muxWebhook });

authComponent.registerRoutes(http, createAuth);
http.route({
  method: "GET",
  pathPrefix: "/api/import-auth/",
  handler: importOAuthHttp,
});
http.route({
  method: "POST",
  pathPrefix: "/api/import-auth/",
  handler: importOAuthHttp,
});
http.route({
  method: "GET",
  path: "/.well-known/oauth-authorization-server/api/import-auth",
  handler: importOAuthMetadata,
});
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

http.route({
  path: "/api/import-mcp/destinations",
  method: "GET",
  handler: importDestinationsHttp,
});

http.route({
  path: "/api/import-mcp/save",
  method: "POST",
  handler: importSaveHttp,
});

http.route({
  path: "/api/import-mcp/status",
  method: "POST",
  handler: importStatusHttp,
});
http.route({
  path: "/api/import-mcp/retry",
  method: "POST",
  handler: importRetryHttp,
});

http.route({
  path: "/api/import-mcp/eligibility",
  method: "POST",
  handler: importEligibilityHttp,
});

export default http;
