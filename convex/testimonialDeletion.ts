import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const relationshipPurgeBatchSize = 32;

async function enqueueVideoAssetCleanup(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  testimonialId: Id<"testimonials">,
) {
  const targets = [
    asset.providerAssetId
      ? { providerAssetId: asset.providerAssetId }
      : { providerUploadId: asset.providerUploadId },
    ...(asset.downloadProviderAssetId
      ? [{ providerAssetId: asset.downloadProviderAssetId }]
      : []),
  ];
  for (const target of targets) {
    const cleanupJobId = await ctx.db.insert("videoProviderCleanupJobs", {
      attempts: 0,
      createdAt: Date.now(),
      organizationId: asset.organizationId,
      provider: asset.provider,
      ...target,
      testimonialId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.videoMedia.processProviderCleanup,
      { cleanupJobId },
    );
  }
}

async function purgeTestimonialRelationshipBatch(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  testimonialId: Id<"testimonials">,
  includeVideoRelations: boolean,
) {
  const [consent, deliveries, projection, quarantines, replacementItems] =
    await Promise.all([
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique(),
      ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .take(relationshipPurgeBatchSize),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique(),
      ctx.db
        .query("spamQuarantines")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .take(relationshipPurgeBatchSize),
      ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .take(relationshipPurgeBatchSize),
    ]);
  const [retryLinks, revisions] = includeVideoRelations
    ? await Promise.all([
        ctx.db
          .query("videoRetryLinks")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .take(relationshipPurgeBatchSize),
        ctx.db
          .query("submissionVideoRevisions")
          .withIndex("by_testimonial_status", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .take(relationshipPurgeBatchSize),
      ])
    : [[], []];

  if (projection) await ctx.db.delete(projection._id);
  if (consent) await ctx.db.delete(consent._id);
  for (const delivery of deliveries) await ctx.db.delete(delivery._id);
  for (const quarantine of quarantines) await ctx.db.delete(quarantine._id);
  for (const item of replacementItems) {
    await ctx.db.delete(item._id);
    const remaining = await ctx.db
      .query("managementLinkReplacementItems")
      .withIndex("by_request", (index) => index.eq("requestId", item.requestId))
      .first();
    if (!remaining) {
      const request = await ctx.db.get(item.requestId);
      if (request) await ctx.db.delete(request._id);
    }
  }
  for (const retryLink of retryLinks) {
    await ctx.db.delete(retryLink._id);
    const asset = await ctx.db.get(retryLink.videoAssetId);
    if (asset) {
      await enqueueVideoAssetCleanup(ctx, asset, testimonialId);
      await ctx.db.delete(asset._id);
      const reservation = await ctx.db.get(asset.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
  }
  for (const revision of revisions) {
    await ctx.db.delete(revision._id);
    if (revision.videoAssetId) {
      const asset = await ctx.db.get(revision.videoAssetId);
      if (asset) {
        await enqueueVideoAssetCleanup(ctx, asset, testimonialId);
        await ctx.db.delete(asset._id);
      }
    }
    const reservation = await ctx.db.get(revision.reservationId);
    if (reservation) await ctx.db.delete(reservation._id);
  }

  const hasMore = [
    deliveries,
    quarantines,
    replacementItems,
    retryLinks,
    revisions,
  ].some((records) => records.length === relationshipPurgeBatchSize);
  if (hasMore) {
    await ctx.scheduler.runAfter(
      0,
      internal.testimonialDeletion.continueTestimonialRelationshipPurge,
      { includeVideoRelations, organizationId, testimonialId },
    );
  }
}

export async function beginTestimonialRelationshipPurge(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  testimonialId: Id<"testimonials">,
  includeVideoRelations: boolean,
) {
  await purgeTestimonialRelationshipBatch(
    ctx,
    organizationId,
    testimonialId,
    includeVideoRelations,
  );
}

export const continueTestimonialRelationshipPurge = internalMutation({
  args: {
    includeVideoRelations: v.boolean(),
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await purgeTestimonialRelationshipBatch(
      ctx,
      args.organizationId,
      args.testimonialId,
      args.includeVideoRelations,
    );
    return null;
  },
});
