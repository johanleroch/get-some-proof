import betterAuth from "@convex-dev/better-auth/convex.config";
import stripe from "@convex-dev/stripe/convex.config.js";
import authz from "@djpanda/convex-authz/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
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
    VIDEO_WEBHOOK_INGEST_SECRET: v.optional(v.string()),
    STRIPE_SECRET_KEY: v.optional(v.string()),
    STRIPE_WEBHOOK_SECRET: v.optional(v.string()),
  },
});

app.use(betterAuth);
app.use(authz);
app.use(stripe);

export default app;
