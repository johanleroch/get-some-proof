import betterAuth from "@convex-dev/better-auth/convex.config";
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
  },
});

app.use(betterAuth);
app.use(authz);

export default app;
