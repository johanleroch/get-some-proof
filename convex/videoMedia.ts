import {
  mediaDeletionProgress,
  emptyMediaProgress,
} from "./domain/mediaDeletionProgress";
import {
  registerImages,
  registerVideo,
  assertMediaDeleted,
} from "./deletionMedia";
import { deleteNextMedia } from "./deletionMediaActions";
import { rememberUnresolvedImportCopy } from "./videoImportCleanup";
import { finishSpamQuarantineForDeletion } from "./testimonialDeletion";
import { removePublicProjection } from "./publicProjection";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import {
  beginTestimonialAuditPurge,
  recordOrganizationAuditEvent,
} from "./auditEvents";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { deleteTestimonialRecords } from "./testimonialDeletion";
import { cancelVideoDirectUpload, deleteVideoAsset } from "./videoProvider";

const providerValidator = v.union(v.literal("fake"), v.literal("mux"));

function testimonialUnavailable(): never {
  throw new ConvexError({
    code: "TESTIMONIAL_UNAVAILABLE",
    message: "Testimonial unavailable.",
  });
}

export const completeProviderCleanup = internalMutation({
  args: {
    cleanupJobId: v.id("videoProviderCleanupJobs"),
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.cleanupJobId);
    if (job && job.organizationId === args.organizationId) {
      await ctx.db.delete(job._id);
    }
    return null;
  },
});

export const readProviderCleanup = internalMutation({
  args: { cleanupJobId: v.id("videoProviderCleanupJobs") },
  returns: v.union(
    v.null(),
    v.object({
      provider: providerValidator,
      providerAssetId: v.optional(v.string()),
      providerUploadId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.cleanupJobId);
    if (!job) return null;
    return {
      provider: job.provider,
      providerAssetId: job.providerAssetId,
      providerUploadId: job.providerUploadId,
    };
  },
});

export const completeProviderCleanupSystem = internalMutation({
  args: { cleanupJobId: v.id("videoProviderCleanupJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.cleanupJobId);
    if (job) await ctx.db.delete(job._id);
    return null;
  },
});

export const scheduleProviderCleanupRetry = internalMutation({
  args: { cleanupJobId: v.id("videoProviderCleanupJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.cleanupJobId);
    if (!job) return null;
    const attempts = job.attempts + 1;
    await ctx.db.patch(job._id, { attempts });
    await ctx.scheduler.runAfter(
      Math.min(60_000, 1_000 * 2 ** Math.min(attempts - 1, 6)),
      internal.videoMedia.processProviderCleanup,
      { cleanupJobId: job._id },
    );
    return null;
  },
});

export const processProviderCleanup = internalAction({
  args: { cleanupJobId: v.id("videoProviderCleanupJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job: {
      provider: "fake" | "mux";
      providerAssetId?: string;
      providerUploadId?: string;
    } | null = await ctx.runMutation(
      internal.videoMedia.readProviderCleanup,
      args,
    );
    if (!job) return null;
    try {
      if (job.providerAssetId) {
        await deleteVideoAsset(job.providerAssetId, job.provider);
      } else if (job.providerUploadId) {
        await cancelVideoDirectUpload(job.providerUploadId, job.provider);
      } else {
        throw new Error("Video cleanup target missing.");
      }
      await ctx.runMutation(
        internal.videoMedia.completeProviderCleanupSystem,
        args,
      );
    } catch {
      await ctx.runMutation(
        internal.videoMedia.scheduleProviderCleanupRetry,
        args,
      );
    }
    return null;
  },
});

export const prepareRemoval = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({
    deletionId: v.id("videoMediaDeletions"),
    alreadyDeleted: v.boolean(),
    cleanupJobIds: v.array(v.id("videoProviderCleanupJobs")),
    providerAssets: v.array(
      v.object({
        provider: providerValidator,
        providerAssetId: v.string(),
      }),
    ),
    providerUploads: v.array(
      v.object({
        provider: providerValidator,
        providerUploadId: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const existing = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .unique();
    if (existing && existing.organizationId !== access.organization._id) {
      testimonialUnavailable();
    }
    if (existing?.status === "deleted") {
      const cleanupJobs = await ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", args.testimonialId),
        )
        .take(32);
      if (cleanupJobs.length > 0) {
        return {
          deletionId: existing._id,
          alreadyDeleted: false,
          cleanupJobIds: cleanupJobs.map((job) => job._id),
          providerAssets: cleanupJobs.flatMap((job) =>
            job.providerAssetId
              ? [
                  {
                    provider: job.provider,
                    providerAssetId: job.providerAssetId,
                  },
                ]
              : [],
          ),
          providerUploads: cleanupJobs.flatMap((job) =>
            job.providerUploadId
              ? [
                  {
                    provider: job.provider,
                    providerUploadId: job.providerUploadId,
                  },
                ]
              : [],
          ),
        };
      }
      return {
        deletionId: existing._id,
        alreadyDeleted: true,
        cleanupJobIds: [],
        providerAssets: [],
        providerUploads: [],
      };
    }

    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id
    ) {
      testimonialUnavailable();
    }
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!asset && testimonial.submissionType === "video")
      testimonialUnavailable();
    await finishSpamQuarantineForDeletion(ctx, testimonial);

    const [cleanupJobs, projection, retryLink, activeRevision] =
      await Promise.all([
        ctx.db
          .query("videoProviderCleanupJobs")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .take(32),
        ctx.db
          .query("publicTestimonialProjections")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique(),
        ctx.db
          .query("videoRetryLinks")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .order("desc")
          .first(),
        ctx.db
          .query("submissionVideoRevisions")
          .withIndex("by_testimonial_status", (index) =>
            index.eq("testimonialId", testimonial._id).eq("status", "active"),
          )
          .unique(),
      ]);
    if (projection) await removePublicProjection(ctx, projection);
    const retryAsset = retryLink
      ? await ctx.db.get(retryLink.videoAssetId)
      : null;
    const revisionAsset = activeRevision?.videoAssetId
      ? await ctx.db.get(activeRevision.videoAssetId)
      : null;
    const allAssets = [asset, retryAsset, revisionAsset];
    const providerAssets = allAssets
      .filter((candidate) => candidate?.providerAssetId)
      .map((candidate) => ({
        provider: candidate!.provider,
        providerAssetId: candidate!.providerAssetId!,
      }))
      .filter(
        (candidate, index, all) =>
          all.findIndex(
            (other) =>
              other.provider === candidate.provider &&
              other.providerAssetId === candidate.providerAssetId,
          ) === index,
      );
    for (const candidate of allAssets) {
      if (
        candidate?.downloadProviderAssetId &&
        !providerAssets.some(
          (target) =>
            target.provider === candidate.provider &&
            target.providerAssetId === candidate.downloadProviderAssetId,
        )
      ) {
        providerAssets.push({
          provider: candidate.provider,
          providerAssetId: candidate.downloadProviderAssetId,
        });
      }
    }
    for (const cleanupJob of cleanupJobs) {
      if (!cleanupJob.providerAssetId) continue;
      if (
        !providerAssets.some(
          (candidate) =>
            candidate.provider === cleanupJob.provider &&
            candidate.providerAssetId === cleanupJob.providerAssetId,
        )
      ) {
        providerAssets.push({
          provider: cleanupJob.provider,
          providerAssetId: cleanupJob.providerAssetId,
        });
      }
    }
    const providerUploads = allAssets
      .filter(
        (candidate) =>
          candidate?.providerUploadId && !candidate.providerAssetId,
      )
      .map((candidate) => ({
        provider: candidate!.provider,
        providerUploadId: candidate!.providerUploadId!,
      }))
      .filter(
        (candidate, index, all) =>
          all.findIndex(
            (other) =>
              other.provider === candidate.provider &&
              other.providerUploadId === candidate.providerUploadId,
          ) === index,
      );
    for (const cleanupJob of cleanupJobs) {
      if (
        cleanupJob.providerUploadId &&
        !providerUploads.some(
          (candidate) =>
            candidate.provider === cleanupJob.provider &&
            candidate.providerUploadId === cleanupJob.providerUploadId,
        )
      ) {
        providerUploads.push({
          provider: cleanupJob.provider,
          providerUploadId: cleanupJob.providerUploadId,
        });
      }
    }

    const now = Date.now();
    let deletionId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, {
        attempts: existing.attempts + 1,
        inventoryStage: 0,
        inventoryCursor: undefined,
        lastError: undefined,
        providerAssets,
        providerUploads,
        status: "requested",
        updatedAt: now,
      });
    } else {
      deletionId = await ctx.db.insert("videoMediaDeletions", {
        attempts: 1,
        createdAt: now,
        organizationId: access.organization._id,
        providerAssets,
        providerUploads,
        status: "requested",
        testimonialId: testimonial._id,
        updatedAt: now,
      });
    }
    if (!deletionId) throw new Error("Deletion unavailable.");
    await registerImages(ctx, deletionId, testimonial);
    const images = await ctx.db
      .query("testimonialImages")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", testimonial._id),
      )
      .take(4);
    for (const image of images) await registerImages(ctx, deletionId, image);
    for (const target of [...providerAssets, ...providerUploads])
      await registerVideo(ctx, deletionId, target);
    for (const candidate of allAssets)
      if (candidate) await rememberUnresolvedImportCopy(ctx, candidate);
    const fresh = await ctx.db.get(deletionId);
    await ctx.db.patch(deletionId, {
      mediaProgress: {
        ...(fresh?.mediaProgress ?? emptyMediaProgress()),
        inventoryComplete: false,
      },
    });
    return {
      deletionId,
      alreadyDeleted: false,
      cleanupJobIds: cleanupJobs.map((job) => job._id),
      providerAssets,
      providerUploads,
    };
  },
});

export const recordRemovalFailure = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .unique();
    if (!deletion || deletion.organizationId !== args.organizationId) {
      testimonialUnavailable();
    }
    await ctx.db.patch(deletion._id, {
      lastError: args.error,
      status: deletion.status === "deleted" ? "deleted" : "failed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const finalizeRemoval = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .unique();
    if (!deletion || deletion.organizationId !== access.organization._id) {
      testimonialUnavailable();
    }
    if (deletion.status === "deleted") return { deleted: true };

    const pendingCleanupJob = await ctx.db
      .query("videoProviderCleanupJobs")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .first();
    if (pendingCleanupJob) {
      throw new ConvexError({
        code: "VIDEO_PROVIDER_CLEANUP_PENDING",
        message: "Video provider cleanup is still pending.",
      });
    }

    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id
    ) {
      testimonialUnavailable();
    }
    await registerImages(ctx, deletion._id, testimonial);
    const assets = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", testimonial._id),
      )
      .take(8);
    for (const asset of assets) {
      await registerVideo(ctx, deletion._id, asset);
      const unresolved = await ctx.db
        .query("videoImportCleanupIntents")
        .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
        .first();
      if (unresolved)
        throw new Error("Waiting for the video provider to confirm cleanup.");
    }
    await assertMediaDeleted(ctx, deletion._id);
    await deleteTestimonialRecords(ctx, testimonial, "permanentDeletion", true);
    const deletionEventId = await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: access.principal.name,
      actorUserId: access.principal.actorId,
      eventType: "testimonial.deleted",
      organizationId: access.organization._id,
      previousValue: testimonial.moderationStatus,
      targetId: String(testimonial._id),
      targetLabel: "Deleted Testimonial",
      targetType: "testimonial",
    });
    await beginTestimonialAuditPurge(
      ctx,
      access.organization._id,
      testimonial._id,
      deletionEventId,
    );
    await ctx.db.patch(deletion._id, {
      lastError: undefined,
      providerAssets: [],
      providerUploads: [],
      status: "deleted",
      updatedAt: Date.now(),
    });
    return { deleted: true };
  },
});

export const remove = action({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args): Promise<{ deleted: boolean }> => {
    const prepared: {
      deletionId: import("./_generated/dataModel").Id<"videoMediaDeletions">;
      alreadyDeleted: boolean;
      cleanupJobIds: Array<
        import("./_generated/dataModel").Id<"videoProviderCleanupJobs">
      >;
      providerAssets: Array<{
        provider: "fake" | "mux";
        providerAssetId: string;
      }>;
      providerUploads: Array<{
        provider: "fake" | "mux";
        providerUploadId: string;
      }>;
    } = await ctx.runMutation(internal.videoMedia.prepareRemoval, args);
    if (prepared.alreadyDeleted) return { deleted: true };
    try {
      while (
        !(await ctx.runMutation(internal.testimonialDeletionInventory.advance, {
          deletionId: prepared.deletionId,
        }))
      ) {
        /* Bounded inventory pages. */
      }
      while (await deleteNextMedia(ctx, prepared.deletionId)) {
        /* Each receipt commits progress. */
      }
      for (const cleanupJobId of prepared.cleanupJobIds) {
        await ctx.runMutation(internal.videoMedia.completeProviderCleanup, {
          cleanupJobId,
          organizationId: args.organizationId,
        });
      }
      return await ctx.runMutation(internal.videoMedia.finalizeRemoval, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.videoMedia.recordRemovalFailure, {
        ...args,
        error: message,
      });
      throw error;
    }
  },
});

export const getRemovalStatus = query({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("requested"),
        v.literal("failed"),
        v.literal("deleted"),
      ),
      mediaProgress: v.optional(mediaDeletionProgress),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", args.testimonialId),
      )
      .unique();
    if (!deletion || deletion.organizationId !== args.organizationId)
      return null;
    return { status: deletion.status, mediaProgress: deletion.mediaProgress };
  },
});
