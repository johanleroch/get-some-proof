import { registerVideo, videoCleanupTargets } from "./deletionMedia";
import { removePublicProjection } from "./publicProjection";
import { cancel, type WorkflowId } from "@convex-dev/workflow";
import { deleteTestimonialImages } from "./testimonialImages";
import {
  preserveImportCopyCleanup,
  rememberUnresolvedImportCopy,
} from "./videoImportCleanup";
import { v } from "convex/values";
import { deleteImageAsset } from "./imageAssetRegistry";

import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const relationshipPurgeBatchSize = 32;

export async function enqueueAssetCleanup(
  ctx: MutationCtx,
  input: {
    accountId?: Id<"accounts">;
    organizationId: Id<"organizations">;
    provider: "fake" | "mux";
    providerAssetId?: string;
    providerUploadId?: string;
    testimonialId?: Id<"testimonials">;
  },
) {
  if (!input.providerAssetId && !input.providerUploadId) return;
  const workspaceDeletion = await ctx.db
    .query("workspaceDeletions")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", input.organizationId),
    )
    .unique();
  if (workspaceDeletion && workspaceDeletion.status !== "deleted")
    await registerVideo(ctx, workspaceDeletion._id, input);
  if (input.testimonialId) {
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", input.testimonialId!),
      )
      .unique();
    if (deletion && deletion.status !== "deleted")
      await registerVideo(ctx, deletion._id, input);
  }
  const existing = input.providerAssetId
    ? await ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_provider_asset", (q) =>
          q
            .eq("provider", input.provider)
            .eq("providerAssetId", input.providerAssetId),
        )
        .first()
    : await ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_provider_upload", (q) =>
          q
            .eq("provider", input.provider)
            .eq("providerUploadId", input.providerUploadId),
        )
        .first();
  if (existing) return;
  const cleanupJobId = await ctx.db.insert("videoProviderCleanupJobs", {
    accountId:
      input.accountId ?? (await ctx.db.get(input.organizationId))?.accountId,
    attempts: 0,
    createdAt: Date.now(),
    organizationId: input.organizationId,
    provider: input.provider,
    providerAssetId: input.providerAssetId,
    providerUploadId: input.providerUploadId,
    testimonialId: input.testimonialId,
  });
  await ctx.scheduler.runAfter(0, internal.videoMedia.processProviderCleanup, {
    cleanupJobId,
  });
}

export async function enqueueVideoAssetCleanup(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  testimonialId: Id<"testimonials"> | undefined = asset.testimonialId,
) {
  await rememberUnresolvedImportCopy(ctx, asset);
  const deletion = testimonialId
    ? await ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", testimonialId),
        )
        .unique()
    : null;
  if (deletion?.mediaProgress?.inventoryComplete) {
    const receipts = await Promise.all(
      videoCleanupTargets(asset).map((target) =>
        ctx.db
          .query("deletionMediaTargets")
          .withIndex("by_deletion_resource", (q) =>
            q
              .eq("deletionId", deletion._id)
              .eq("provider", target.provider)
              .eq("kind", target.kind)
              .eq("resourceId", target.resourceId),
          )
          .unique(),
      ),
    );
    if (receipts.every((receipt) => receipt?.deletedAt !== undefined)) return;
    if (deletion.status !== "deleted")
      throw new Error("New video media must be cleaned up before deletion.");
  }
  if (asset.cleanupScheduled) return;
  await ctx.db.patch(asset._id, { cleanupScheduled: true });
  await enqueueAssetCleanup(ctx, {
    organizationId: asset.organizationId,
    provider: asset.provider,
    providerAssetId: asset.providerAssetId,
    providerUploadId: asset.providerAssetId
      ? undefined
      : asset.providerUploadId,
    testimonialId,
  });
  if (asset.downloadProviderAssetId) {
    await enqueueAssetCleanup(ctx, {
      organizationId: asset.organizationId,
      provider: asset.provider,
      providerAssetId: asset.downloadProviderAssetId,
      testimonialId,
    });
  }
}

async function purgeTestimonialRelationshipBatch(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  testimonialId: Id<"testimonials">,
  includeVideoRelations: boolean,
  preserveQuarantines = false,
) {
  const [
    consent,
    deliveries,
    projection,
    quarantines,
    replacementItems,
    importItems,
  ] = await Promise.all([
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
    preserveQuarantines
      ? []
      : ctx.db
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
    ctx.db
      .query("testimonialImportItems")
      .withIndex("by_testimonialId", (index) =>
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

  if (projection) await removePublicProjection(ctx, projection);
  if (consent) await ctx.db.delete(consent._id);
  for (const item of importItems) {
    if (item.workflowId)
      await cancel(ctx, components.workflow, item.workflowId as WorkflowId);
    await ctx.db.delete(item._id);
    const job = await ctx.db.get(item.jobId);
    if (job)
      await ctx.db.patch(job._id, {
        selectedItemIds: job.selectedItemIds?.filter((id) => id !== item._id),
      });
  }
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
    if (retryLink.replacementReservationId) {
      const replacement = await ctx.db.get(retryLink.replacementReservationId);
      if (replacement) await ctx.db.delete(replacement._id);
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
    importItems,
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
      {
        includeVideoRelations,
        organizationId,
        testimonialId,
        preserveQuarantines,
      },
    );
  }
}

export const continueTestimonialRelationshipPurge = internalMutation({
  args: {
    includeVideoRelations: v.boolean(),
    preserveQuarantines: v.optional(v.boolean()),
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
      args.preserveQuarantines,
    );
    return null;
  },
});

/** An explicit deletion ends reversibility but retains the Spam credit history. */
export async function finishSpamQuarantineForDeletion(
  ctx: MutationCtx,
  testimonial: Doc<"testimonials">,
) {
  if (testimonial.moderationStatus !== "spam") return;
  const quarantine = await ctx.db
    .query("spamQuarantines")
    .withIndex("by_testimonial", (index) =>
      index.eq("testimonialId", testimonial._id),
    )
    .order("desc")
    .first();
  if (quarantine?.status === "active") {
    await ctx.db.patch(quarantine._id, {
      status: "expired",
      updatedAt: Date.now(),
    });
  }
}

/** Invalidates proof immediately and resumes its private relationship purge in bounded batches.
 * Owner video deletion must complete current provider media deletion before entering here.
 */
export async function deleteTestimonialRecords(
  ctx: MutationCtx,
  testimonial: Doc<"testimonials">,
  reason:
    | "permanentDeletion"
    | "consentWithdrawal"
    | "spamExpiry" = "permanentDeletion",
  mediaAlreadyHandled = false,
) {
  if (reason === "permanentDeletion")
    await finishSpamQuarantineForDeletion(ctx, testimonial);
  if (testimonial.submissionType === "video") {
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (asset) {
      if (!mediaAlreadyHandled) await preserveImportCopyCleanup(ctx, asset);
      if (reason !== "permanentDeletion")
        await enqueueVideoAssetCleanup(ctx, asset, testimonial._id);
      await ctx.db.delete(asset._id);
      const reservation = await ctx.db.get(asset.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    const retention = await ctx.db
      .query("videoDowngradeRetentions")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (retention) await ctx.db.delete(retention._id);
  }
  await purgeTestimonialRelationshipBatch(
    ctx,
    testimonial.organizationId,
    testimonial._id,
    testimonial.submissionType === "video",
    // Retain Spam history until quarantine expiry, including legacy credit accounting.
    reason !== "permanentDeletion" || testimonial.moderationStatus === "spam",
  );
  await deleteTestimonialImages(ctx, testimonial._id, mediaAlreadyHandled);
  if (!mediaAlreadyHandled && testimonial.avatarStorageId)
    await deleteImageAsset(ctx, testimonial.avatarStorageId);
  if (!mediaAlreadyHandled && testimonial.posterStorageId)
    await deleteImageAsset(ctx, testimonial.posterStorageId);
  await ctx.db.delete(testimonial._id);
}
