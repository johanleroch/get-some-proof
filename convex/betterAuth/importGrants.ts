import { v } from "convex/values";
import { query } from "./_generated/server";

/** Component-only policy check. The caller must first verify the OAuth JWT. */
export const resolve = query({
  args: {
    actorId: v.string(),
    clientId: v.string(),
    expiresAt: v.number(),
    verifiedAt: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      actorId: v.string(),
      email: v.string(),
      emailVerified: v.boolean(),
      name: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.verifiedAt) || args.expiresAt <= args.verifiedAt)
      return null;
    const id = ctx.db.normalizeId("user", args.actorId);
    if (!id) return null;
    const user = await ctx.db.get(id);
    if (!user?.emailVerified) return null;
    const client = await ctx.db
      .query("importOAuthClient")
      .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (
      !client ||
      client.disabled ||
      !client.scopes?.includes("testimonials:import")
    )
      return null;
    const consent = await ctx.db
      .query("importOAuthConsent")
      .withIndex("clientId_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    if (!consent?.scopes.includes("testimonials:import")) return null;
    return {
      actorId: args.actorId,
      email: user.email,
      emailVerified: true,
      name: user.name,
    };
  },
});
