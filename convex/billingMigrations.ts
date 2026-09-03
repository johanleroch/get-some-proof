import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const defaultBatchSize = 25;
const maximumBatchSize = 100;

/**
 * Imports pre-existing component Subscription snapshots into the monotone
 * application projection. Run each returned cursor only after deploying this
 * release, and never add `--prod` without a separately approved rollout.
 */
export const backfillSubscriptionStates = internalAction({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.union(v.null(), v.string()),
  },
  returns: v.object({
    applied: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    applied: number;
    continueCursor: string;
    isDone: boolean;
  }> => {
    const batchSize = args.batchSize ?? defaultBatchSize;
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > maximumBatchSize
    ) {
      throw new ConvexError({
        code: "INVALID_MIGRATION_BATCH_SIZE",
        message: `batchSize must be an integer from 1 to ${maximumBatchSize}.`,
      });
    }
    const page = await ctx.runQuery(
      internal.billingMigrationQueries.readOrganizationPage,
      {
        batchSize,
        cursor: args.cursor,
      },
    );
    let applied = 0;
    for (const organization of page.page) {
      const subscriptions = await ctx.runQuery(
        components.stripe.public.listSubscriptionsByOrgId,
        { orgId: String(organization._id) },
      );
      for (const subscription of subscriptions) {
        const result = await ctx.runMutation(
          internal.stripeWebhookSync.applySubscriptionEvent,
          {
            cancelAt: subscription.cancelAt,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            currentPeriodEnd: subscription.currentPeriodEnd,
            // A compatibility snapshot must never outrank a signed Stripe
            // event. Zero makes this insert-only in the monotone projection.
            eventCreated: 0,
            eventId: `migration:${subscription.stripeSubscriptionId}:${subscription.status}:${subscription.priceId}`,
            eventType: "migration.subscription.snapshot",
            organizationId: String(organization._id),
            priceId: subscription.priceId,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          },
        );
        if (result.outcome === "applied") applied += 1;
      }
    }
    return {
      applied,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
