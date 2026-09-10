import { v } from "convex/values";
import { defineSchema, defineTable } from "convex/server";
import { tables as legacy } from "./legacySchema";
import { tables as oauth } from "./importOAuthSchema";

// Retain the mounted component name and every existing table. New OAuth data
// uses separate names so legacy OIDC consent/token rows keep their own schema.
export default defineSchema({
  ...legacy,
  importOAuthRevocations: defineTable({
    clientId: v.string(),
    userId: v.string(),
    revokedAt: v.number(),
    generation: v.optional(v.number()),
  }).index("by_clientId_and_userId", ["clientId", "userId"]),
  importOAuthClient: oauth.importOAuthClient,
  importOAuthConsent: oauth.importOAuthConsent,
  importOAuthAccessToken: oauth.importOAuthAccessToken,
  importOAuthRefreshToken: oauth.importOAuthRefreshToken.index(
    "by_clientId_and_userId",
    ["clientId", "userId"],
  ),
});
