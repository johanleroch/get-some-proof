import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";

const windowMs = 60_000;
const readsPerWindow = 120;

function unavailable(): never {
  throw new ConvexError({
    code: "PUBLIC_READ_RATE_LIMIT_UNAVAILABLE",
    message: "Public read protection is unavailable.",
  });
}

export const consume = mutation({
  args: {
    resourceKey: v.string(),
    secret: v.string(),
  },
  returns: v.object({ remaining: v.number(), resetAt: v.number() }),
  handler: async (ctx, args) => {
    const expectedSecret = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
    if (
      !expectedSecret ||
      expectedSecret.length < 32 ||
      args.secret !== expectedSecret ||
      !/^embed:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.resourceKey) ||
      args.resourceKey.length > 54
    ) {
      unavailable();
    }

    const now = Date.now();
    const windowStartedAt = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStartedAt + windowMs;
    const bucket = await ctx.db
      .query("publicReadRateLimitBuckets")
      .withIndex("by_resource_window", (index) =>
        index
          .eq("resourceKey", args.resourceKey)
          .eq("windowStartedAt", windowStartedAt),
      )
      .unique();
    const count = bucket?.count ?? 0;
    if (count >= readsPerWindow) {
      throw new ConvexError({
        code: "PUBLIC_READ_RATE_LIMITED",
        message: "Too many Public Wall reads. Try again shortly.",
        retryAfterMs: Math.max(resetAt - now, 1),
      });
    }
    if (bucket) {
      await ctx.db.patch(bucket._id, { count: count + 1 });
    } else {
      await ctx.db.insert("publicReadRateLimitBuckets", {
        count: 1,
        expiresAt: resetAt + windowMs,
        resourceKey: args.resourceKey,
        windowStartedAt,
      });
    }

    const expired = await ctx.db
      .query("publicReadRateLimitBuckets")
      .withIndex("by_expires_at", (index) => index.lt("expiresAt", now))
      .take(20);
    await Promise.all(expired.map((item) => ctx.db.delete(item._id)));
    return { remaining: readsPerWindow - count - 1, resetAt };
  },
});
