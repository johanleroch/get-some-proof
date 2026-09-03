import { ConvexError, v } from "convex/values";

import { mutation, type MutationCtx } from "./_generated/server";

const windowMs = 60_000;
const requesterReadsPerBrandWindow = 30;
const globalReadsPerBrandWindow = 600;
const requesterLookupsPerWindow = 60;
const globalLookupsPerWindow = 6_000;

type Limit = { limit: number; resourceKey: string };

function unavailable(): never {
  throw new ConvexError({
    code: "PUBLIC_READ_RATE_LIMIT_UNAVAILABLE",
    message: "Public read protection is unavailable.",
  });
}

function validateCaller(secret: string, requesterKey: string) {
  const expectedSecret = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
  if (
    !expectedSecret ||
    expectedSecret.length < 32 ||
    secret !== expectedSecret ||
    !/^[a-f0-9]{32}$/.test(requesterKey)
  ) {
    unavailable();
  }
}

async function consumeLimits(ctx: MutationCtx, limits: Limit[]) {
  const now = Date.now();
  const windowStartedAt = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStartedAt + windowMs;
  const buckets = await Promise.all(
    limits.map(({ resourceKey }) =>
      ctx.db
        .query("publicReadRateLimitBuckets")
        .withIndex("by_resource_window", (index) =>
          index
            .eq("resourceKey", resourceKey)
            .eq("windowStartedAt", windowStartedAt),
        )
        .unique(),
    ),
  );
  if (
    limits.some(({ limit }, index) => (buckets[index]?.count ?? 0) >= limit)
  ) {
    throw new ConvexError({
      code: "PUBLIC_READ_RATE_LIMITED",
      message: "Too many Public Wall reads. Try again shortly.",
      retryAfterMs: Math.max(resetAt - now, 1),
    });
  }
  await Promise.all(
    limits.map(({ resourceKey }, index) => {
      const bucket = buckets[index];
      return bucket
        ? ctx.db.patch(bucket._id, { count: bucket.count + 1 })
        : ctx.db.insert("publicReadRateLimitBuckets", {
            count: 1,
            expiresAt: resetAt + windowMs,
            resourceKey,
            windowStartedAt,
          });
    }),
  );

  const expired = await ctx.db
    .query("publicReadRateLimitBuckets")
    .withIndex("by_expires_at", (index) => index.lt("expiresAt", now))
    .take(20);
  await Promise.all(expired.map((item) => ctx.db.delete(item._id)));
  return {
    remaining: limits[0]!.limit - (buckets[0]?.count ?? 0) - 1,
    resetAt,
  };
}

export const consumeLookup = mutation({
  args: {
    requesterKey: v.string(),
    secret: v.string(),
  },
  returns: v.object({ remaining: v.number(), resetAt: v.number() }),
  handler: async (ctx, args) => {
    validateCaller(args.secret, args.requesterKey);
    return consumeLimits(ctx, [
      {
        limit: requesterLookupsPerWindow,
        resourceKey: `embed:lookup:requester:${args.requesterKey}`,
      },
      {
        limit: globalLookupsPerWindow,
        resourceKey: "embed:lookup:global",
      },
    ]);
  },
});

export const consume = mutation({
  args: {
    publicSlug: v.string(),
    requesterKey: v.string(),
    secret: v.string(),
  },
  returns: v.object({ remaining: v.number(), resetAt: v.number() }),
  handler: async (ctx, args) => {
    validateCaller(args.secret, args.requesterKey);
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.publicSlug) ||
      args.publicSlug.length > 48
    ) {
      unavailable();
    }
    return consumeLimits(ctx, [
      {
        limit: requesterReadsPerBrandWindow,
        resourceKey: `embed:${args.publicSlug}:requester:${args.requesterKey}`,
      },
      {
        limit: globalReadsPerBrandWindow,
        resourceKey: `embed:${args.publicSlug}:global`,
      },
    ]);
  },
});
