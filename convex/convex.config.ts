import betterAuth from "@convex-dev/better-auth/convex.config";
import authz from "@djpanda/convex-authz/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();

app.use(betterAuth);
app.use(authz);

export default app;
