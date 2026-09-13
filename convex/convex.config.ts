import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import betterAuth from "./betterAuth/convex.config";
import stripe from "@convex-dev/stripe/convex.config.js";
import authz from "@djpanda/convex-authz/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";
import workflow from "@convex-dev/workflow/convex.config";
import migrations from "@convex-dev/migrations/convex.config.js";

const app = defineApp({
  env: {
    GOOGLE_BUSINESS_PUBSUB_TOPIC: v.optional(v.string()),
    GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION: v.optional(v.string()),
    GOOGLE_BUSINESS_PUBSUB_AUDIENCE: v.optional(v.string()),
    GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL: v.optional(v.string()),
    GOOGLE_BUSINESS_CLIENT_ID: v.optional(v.string()),
    GOOGLE_BUSINESS_CLIENT_SECRET: v.optional(v.string()),
    GOOGLE_BUSINESS_ENCRYPTION_KEY: v.optional(v.string()),
    GOOGLE_BUSINESS_REDIRECT_URI: v.optional(v.string()),
    CHATGPT_IMPORT_ENABLED: v.optional(
      v.union(v.literal("true"), v.literal("false")),
    ),
    EMAIL_FROM: v.optional(v.string()),
    EMAIL_PROVIDER: v.union(
      v.literal("console"),
      v.literal("resend"),
      v.literal("test"),
    ),
    RESEND_API_KEY: v.optional(v.string()),
    SITE_URL: v.string(),
    MUX_PROVIDER: v.optional(v.union(v.literal("fake"), v.literal("mux"))),
    MUX_TOKEN_ID: v.optional(v.string()),
    MUX_TOKEN_SECRET: v.optional(v.string()),
    MUX_WEBHOOK_SECRET: v.optional(v.string()),
    VIDEO_WEBHOOK_INGEST_SECRET: v.optional(v.string()),
    MANAGEMENT_LINK_TOKEN_SECRET: v.optional(v.string()),
    STRIPE_MODE: v.optional(v.union(v.literal("test"), v.literal("live"))),
    STRIPE_SECRET_KEY: v.optional(v.string()),
    STRIPE_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(authz);
app.use(stripe);
app.use(rateLimiter);
app.use(workflow);
app.use(migrations);

export default app;
