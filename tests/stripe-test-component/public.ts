import { v } from "convex/values";

import { query } from "./_generated/server";

const subscription = v.object({
  cancelAt: v.optional(v.number()),
  cancelAtPeriodEnd: v.boolean(),
  currentPeriodEnd: v.number(),
  metadata: v.optional(v.any()),
  orgId: v.optional(v.string()),
  priceId: v.string(),
  quantity: v.optional(v.number()),
  status: v.string(),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
  userId: v.optional(v.string()),
});

export const listSubscriptionsByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(subscription),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_org_id", (index) => index.eq("orgId", args.orgId))
      .collect();

    return subscriptions.map((record) => ({
      cancelAt: record.cancelAt,
      cancelAtPeriodEnd: record.cancelAtPeriodEnd,
      currentPeriodEnd: record.currentPeriodEnd,
      metadata: record.metadata,
      orgId: record.orgId,
      priceId: record.priceId,
      quantity: record.quantity,
      status: record.status,
      stripeCustomerId: record.stripeCustomerId,
      stripeSubscriptionId: record.stripeSubscriptionId,
      userId: record.userId,
    }));
  },
});
