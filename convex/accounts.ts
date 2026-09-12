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
      testimonialLinksEnabled: v.boolean(),
      deletionStartedAt: v.optional(v.number()),
      freeProjectId: v.union(v.id("organizations"), v.null()),
      freeProjectName: v.union(v.string(), v.null()),
      effectivePlan: v.union(v.literal("free"), v.literal("premium")),
      usage: v.object({
        freeTextUsed: v.number(),
        freeVideoUsed: v.number(),
        readyVideos: v.number(),
        reservedVideos: v.number(),
        videoLimit: v.number(),
        textTestimonials: v.number(),
        textTestimonialsIsLowerBound: v.boolean(),
        organizations: v.number(),
        organizationsIsLowerBound: v.boolean(),
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
    const [
      entitlement,
      textCredits,
      videoCredits,
      ready,
      reserved,
      cleanup,
      pendingCredits,
      uncertainCleanup,
    ] = await Promise.all([
      getAccountBillingEntitlement(ctx, account._id),
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
      ctx.db
        .query("videoImportCleanupIntents")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .take(premiumReadyVideoLimit),
    ]);
    // Bound sidebar reads across the entire Account, never per-project times
    // the text limit. The UI marks a lower bound instead of claiming a total.
    const organizationLimit = 100;
    const textLimit = 500;
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_account_open", (q) =>
        q.eq("accountId", account._id).eq("deletionStartedAt", undefined),
      )
      .take(organizationLimit + 1);
    let textTestimonials = 0;
    for (const organization of organizations.slice(0, organizationLimit)) {
      const texts = await ctx.db
        .query("testimonials")
        .withIndex("by_organization_submission_type", (q) =>
          q.eq("organizationId", organization._id).eq("submissionType", "text"),
        )
        .take(textLimit + 1 - textTestimonials);
      textTestimonials += texts.length;
      if (textTestimonials > textLimit) break;
    }
    const freeProject = await resolveFreeProject(ctx, account);
    return {
      id: account._id,
      testimonialLinksEnabled: account.testimonialLinksEnabled ?? true,
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
          uncertainCleanup.length +
          (entitlement.effectivePlan === "free" ? pendingCredits.length : 0),
        videoLimit:
          entitlement.effectivePlan === "premium"
            ? premiumReadyVideoLimit
            : freeVideoCreditLimit,
        textTestimonials: Math.min(textTestimonials, textLimit),
        textTestimonialsIsLowerBound:
          textTestimonials > textLimit ||
          organizations.length > organizationLimit,
        organizations: Math.min(organizations.length, organizationLimit),
        organizationsIsLowerBound: organizations.length > organizationLimit,
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

export const setTestimonialLinksEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    if (!account || account.deletionStartedAt !== undefined)
      throw new ConvexError("Account unavailable.");
    if ((account.testimonialLinksEnabled ?? true) !== enabled)
      await ctx.db.patch(account._id, {
        testimonialLinksEnabled: enabled,
        testimonialLinksRevision: (account.testimonialLinksRevision ?? 0) + 1,
        updatedAt: Date.now(),
      });
    return null;
  },
});
