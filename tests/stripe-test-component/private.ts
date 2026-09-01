import { v } from "convex/values";

import { mutation } from "./_generated/server";

const subscriptionFields = {
  cancelAt: v.optional(v.number()),
  cancelAtPeriodEnd: v.boolean(),
  currentPeriodEnd: v.number(),
  metadata: v.optional(v.any()),
  priceId: v.string(),
  quantity: v.optional(v.number()),
  status: v.string(),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
};

export const handleSubscriptionCreated = mutation({
  args: subscriptionFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    const record = {
      ...args,
      orgId: args.metadata?.orgId as string | undefined,
      userId: args.metadata?.userId as string | undefined,
    };
    if (existing) await ctx.db.replace(existing._id, record);
    else await ctx.db.insert("subscriptions", record);
    return null;
  },
});

export const handleSubscriptionUpdated = mutation({
  args: {
    cancelAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(),
    metadata: v.optional(v.any()),
    priceId: v.optional(v.string()),
    quantity: v.optional(v.number()),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!existing) throw new Error("Subscription missing");
    await ctx.db.patch(existing._id, {
      ...args,
      orgId: args.metadata?.orgId as string | undefined,
      priceId: args.priceId ?? existing.priceId,
      stripeCustomerId: args.stripeCustomerId ?? existing.stripeCustomerId,
      userId: args.metadata?.userId as string | undefined,
    });
    return null;
  },
});
