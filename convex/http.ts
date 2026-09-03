import { httpRouter } from "convex/server";
import { registerRoutes } from "@convex-dev/stripe";

import { components } from "./_generated/api";
import { env } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);
registerRoutes(http, components.stripe, {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  webhookPath: "/stripe/webhook",
});

export default http;
