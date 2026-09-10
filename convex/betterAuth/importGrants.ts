import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** Component-only policy check. The caller must first verify the OAuth JWT. */
export const resolve = query({
  args: {
    actorId: v.string(),
    clientId: v.string(),
    expiresAt: v.number(),
    verifiedAt: v.number(),
    issuedAt: v.number(),
    generation: v.optional(v.number()),
    scope: v.optional(v.string()),
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
    if (
      !Number.isFinite(args.verifiedAt) ||
      !Number.isFinite(args.issuedAt) ||
      args.issuedAt > args.verifiedAt ||
      args.expiresAt <= args.verifiedAt
    )
      return null;
    const revocation = await ctx.db
      .query("importOAuthRevocations")
      .withIndex("by_clientId_and_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    if (args.generation !== undefined) {
      if (
        !Number.isSafeInteger(args.generation) ||
        args.generation !== (revocation?.generation ?? (revocation ? 1 : 0))
      )
        return null;
    } else if (revocation && args.issuedAt <= revocation.revokedAt) return null;
    const requiredScope = args.scope ?? "testimonials:import";
    if (
      !["testimonials:import", "testimonials:import:assistant"].includes(
        requiredScope,
      )
    )
      return null;
    const id = ctx.db.normalizeId("user", args.actorId);
    if (!id) return null;
    const user = await ctx.db.get(id);
    if (!user?.emailVerified) return null;
    const client = await ctx.db
      .query("importOAuthClient")
      .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (!client || client.disabled || !client.scopes?.includes(requiredScope))
      return null;
    const consent = await ctx.db
      .query("importOAuthConsent")
      .withIndex("clientId_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    if (!consent?.scopes.includes(requiredScope)) return null;
    return {
      actorId: args.actorId,
      email: user.email,
      emailVerified: true,
      name: user.name,
    };
  },
});

export const list = query({
  args: { actorId: v.string() },
  returns: v.array(
    v.object({ clientId: v.string(), name: v.string(), createdAt: v.number() }),
  ),
  handler: async (ctx, args) => {
    const consents = await ctx.db
      .query("importOAuthConsent")
      .withIndex("userId", (q) => q.eq("userId", args.actorId))
      .order("desc")
      .take(50);
    const result = await Promise.all(
      consents.map(async (consent) => {
        const client = await ctx.db
          .query("importOAuthClient")
          .withIndex("clientId", (q) => q.eq("clientId", consent.clientId))
          .unique();
        if (
          !client ||
          client.disabled ||
          !consent.scopes.some(
            (scope) =>
              scope === "testimonials:import" ||
              scope === "testimonials:import:assistant",
          )
        )
          return null;
        return {
          clientId: client.clientId,
          name: client.name ?? "Connected app",
          createdAt: consent.createdAt ?? consent._creationTime,
        };
      }),
    );
    return result.filter((value) => value !== null);
  },
});
export const revoke = mutation({
  args: { actorId: v.string(), clientId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const consent = await ctx.db
      .query("importOAuthConsent")
      .withIndex("clientId_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    if (!consent) return null;
    const existing = await ctx.db
      .query("importOAuthRevocations")
      .withIndex("by_clientId_and_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    if (existing)
      await ctx.db.patch(existing._id, {
        revokedAt: Date.now(),
        generation: (existing.generation ?? 1) + 1,
      });
    else
      await ctx.db.insert("importOAuthRevocations", {
        clientId: args.clientId,
        userId: args.actorId,
        revokedAt: Date.now(),
        generation: 1,
      });
    await ctx.db.delete(consent._id);
    return null;
  },
});

export const generation = query({
  args: { actorId: v.string(), clientId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("importOAuthRevocations")
      .withIndex("by_clientId_and_userId", (q) =>
        q.eq("clientId", args.clientId).eq("userId", args.actorId),
      )
      .unique();
    return row?.generation ?? (row ? 1 : 0);
  },
});
