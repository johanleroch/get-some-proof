import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://unconfigured.convex.cloud";
const convexSiteUrl =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://unconfigured.convex.site";

export const {
  fetchAuthAction,
  fetchAuthMutation,
  fetchAuthQuery,
  getToken,
  handler,
  isAuthenticated,
  preloadAuthQuery,
} = convexBetterAuthNextJs({
  convexUrl,
  convexSiteUrl,
});
