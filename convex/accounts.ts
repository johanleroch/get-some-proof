import { ConvexError, v } from "convex/values";

import { internalQuery, mutation, query } from "./_generated/server";
import { getAccountBillingEntitlement } from "./billingEntitlements";
import {
  freeTextCreditLimit,
  freeVideoCreditLimit,
  premiumReadyVideoLimit,
} from "./collectionQuotas";
import { requireVerifiedPrincipal } from "./security/principal";
import { resolveFreeProject } from "./projectActivity";

export const getMine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("accounts"),
      ownerUserId: v.string(),
      canManageSubscription: v.boolean(),
      deletionStartedAt: v.optional(v.number()),
      freeProjectId: v.union(v.id("organizations"), v.null()),
      freeProjectName: v.union(v.string(), v.null()),
      effectivePlan: v.union(v.literal("free"), v.literal("premium")),
      usage: v.object({
        freeTextUsed: v.number(),
        freeVideoUsed: v.number(),
        readyVideos: v.number(),
        reservedVideos: v.number(),
      }),
    }),
  ),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (index) =>
        index.eq("ownerUserId", principal.actorId),
      )
      .unique();
    if (!account) return null;
    const entitlement = await getAccountBillingEntitlement(ctx, account._id);
    const [
      textCredits,
      videoCredits,
      ready,
      reserved,
      cleanup,
      pendingCredits,
    ] = await Promise.all([
      ctx.db
        .query("collectionCredits")
        .withIndex("by_account_type_restored", (q) =>
          q
            .eq("accountId", account._id)
            .eq("submissionType", "text")
            .eq("restoredAt", undefined),
        )
        .take(freeTextCreditLimit),
      ctx.db
        .query("collectionCredits")
        .withIndex("by_account_type_restored", (q) =>
          q
            .eq("accountId", account._id)
            .eq("submissionType", "video")
            .eq("restoredAt", undefined),
        )
        .take(freeVideoCreditLimit),
      ctx.db
        .query("videoAssets")
        .withIndex("by_account_status", (q) =>
          q.eq("accountId", account._id).eq("status", "ready"),
        )
        .take(premiumReadyVideoLimit),
      ctx.db
        .query("videoReservations")
        .withIndex("by_account_status", (q) =>
          q.eq("accountId", account._id).eq("status", "reserved"),
        )
        .take(premiumReadyVideoLimit),
      ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .take(premiumReadyVideoLimit),
      ctx.db
        .query("videoReservations")
        .withIndex("by_account_pending_credit", (q) =>
          q.eq("accountId", account._id).eq("freeCreditPending", true),
        )
        .take(freeVideoCreditLimit),
    ]);
    const freeProject = await resolveFreeProject(ctx, account);
    return {
      id: account._id,
      deletionStartedAt: account.deletionStartedAt,
      ownerUserId: account.ownerUserId,
      canManageSubscription: !!(
        await ctx.db
          .query("billingProfiles")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .unique()
      )?.stripeCustomerId,
      freeProjectId: freeProject?._id ?? null,
      freeProjectName: freeProject?.name ?? null,
      effectivePlan: entitlement.effectivePlan,
      usage: {
        freeTextUsed: textCredits.length,
        freeVideoUsed: videoCredits.length,
        readyVideos: ready.length,
        reservedVideos:
          reserved.length +
          cleanup.length +
          (entitlement.effectivePlan === "free" ? pendingCredits.length : 0),
      },
    };
  },
});

export const selectFreeProject = mutation({
  args: { projectId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    const project = await ctx.db.get(args.projectId);
    if (
      !account ||
      account.deletionStartedAt !== undefined ||
      project?.accountId !== account._id ||
      project.deletionStartedAt !== undefined
    ) {
      throw new ConvexError({
        code: "PROJECT_UNAVAILABLE",
        message: "Project unavailable.",
      });
    }
    if (
      (await getAccountBillingEntitlement(ctx, account._id)).effectivePlan !==
      "premium"
    ) {
      throw new ConvexError({
        code: "PRO_REQUIRED",
        message: "Choose your Free project before your Pro plan ends.",
      });
    }
    await ctx.db.patch(account._id, {
      selectedFreeProjectId: project._id,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getBillingContext = internalQuery({
  args: {},
  returns: v.object({ customerId: v.union(v.string(), v.null()) }),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    if (!account || account.deletionStartedAt !== undefined)
      throw new ConvexError({
        code: "ACCOUNT_UNAVAILABLE",
        message: "Account unavailable.",
      });
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    return { customerId: profile?.stripeCustomerId ?? null };
  },
});
