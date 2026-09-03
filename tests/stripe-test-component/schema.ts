import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  subscriptions: defineTable({
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
  })
    .index("by_org_id", ["orgId"])
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"]),
});
