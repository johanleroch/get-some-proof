"use node";
import { v } from "convex/values";
import { env, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  parseGooglePush,
  verifyGooglePushIdentity,
} from "./lib/googleBusinessPush";

export const ingest = internalAction({
  args: { jwt: v.string(), body: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const audience = env.GOOGLE_BUSINESS_PUBSUB_AUDIENCE;
    const serviceAccountEmail =
      env.GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL;
    const subscription = env.GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION;
    if (!audience || !serviceAccountEmail || !subscription) return 503;
    if (args.jwt.length > 8192 || args.body.length > 16384) return 413;
    try {
      await verifyGooglePushIdentity(args.jwt, {
        audience,
        serviceAccountEmail,
      });
    } catch {
      return 401;
    }
    let event;
    try {
      event = parseGooglePush(args.body, subscription);
    } catch {
      return 400;
    }
    if (event)
      await ctx.runMutation(
        internal.googleBusinessNotifications.receive,
        event,
      );
    // Ack only after the metadata and scheduled delivery are durable. A database
    // failure propagates as 5xx so Pub/Sub retries instead of losing the event.
    return 204;
  },
});
