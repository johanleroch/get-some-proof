import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalAction, internalMutation } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { requireOrganizationPermission } from "./security/organizationAccess";
import {
  cancelVideoDirectUpload,
  createVideoDownloadAsset,
  deleteVideoAsset,
  getVideoDownloadUrl,
} from "./videoProvider";

const providerValidator = v.union(v.literal("fake"), v.literal("mux"));

function testimonialUnavailable(): never {
  throw new ConvexError({
    code: "TESTIMONIAL_UNAVAILABLE",
    message: "Testimonial unavailable.",
  });
}

export const authorizeDownload = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({
    downloadPlaybackId: v.optional(v.string()),
    downloadProviderAssetId: v.optional(v.string()),
    provider: providerValidator,
    providerAssetId: v.string(),
    sourcePlaybackId: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id ||
      testimonial.submissionType !== "video"
    ) {
      testimonialUnavailable();
    }
    if (testimonial.moderationStatus === "spam") testimonialUnavailable();
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    if (entitlement.effectivePlan !== "premium") {
      throw new ConvexError({
        code: "PREMIUM_REQUIRED",
        message: "Pro is required to download a Video Testimonial.",
      });
    }
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (
      !asset ||
      asset.status !== "ready" ||
      !asset.playbackId ||
      !asset.providerAssetId
    ) {
      throw new ConvexError({
        code: "VIDEO_NOT_READY",
        message: "The MP4 is not ready to download.",
      });
    }
    return {
      downloadPlaybackId: asset.downloadPlaybackId,
      downloadProviderAssetId: asset.downloadProviderAssetId,
      provider: asset.provider,
      providerAssetId: asset.providerAssetId,
      sourcePlaybackId: asset.playbackId,
    };
  },
});

export const attachDownloadAsset = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    playbackId: v.string(),
    provider: providerValidator,
    providerAssetId: v.string(),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({
    accepted: v.boolean(),
    cleanupJobId: v.optional(v.id("videoProviderCleanupJobs")),
    playbackId: v.string(),
    providerAssetId: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const cleanupJobId = await ctx.db.insert("videoProviderCleanupJobs", {
      attempts: 0,
      createdAt: Date.now(),
      organizationId: access.organization._id,
      provider: args.provider,
      providerAssetId: args.providerAssetId,
      testimonialId: args.testimonialId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.videoMedia.processProviderCleanup,
      { cleanupJobId },
    );
    const candidateCleanup = {
      accepted: false,
      cleanupJobId,
      playbackId: args.playbackId,
      providerAssetId: args.providerAssetId,
    };
    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id ||
      testimonial.submissionType !== "video"
    ) {
      return candidateCleanup;
    }
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!asset || deletion) return candidateCleanup;
    if (asset.downloadPlaybackId && asset.downloadProviderAssetId) {
      return {
        accepted: true,
        cleanupJobId,
        playbackId: asset.downloadPlaybackId,
        providerAssetId: asset.downloadProviderAssetId,
      };
    }
    await ctx.db.patch(asset._id, {
      downloadPlaybackId: args.playbackId,
      downloadProviderAssetId: args.providerAssetId,
      updatedAt: Date.now(),
    });
    await ctx.db.delete(cleanupJobId);
    return {
      accepted: true,
      playbackId: args.playbackId,
      providerAssetId: args.providerAssetId,
    };
  },
});

export const completeProviderCleanup = internalMutation({
  args: {
    cleanupJobId: v.id("videoProviderCleanupJobs"),
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const job = await ctx.db.get(args.cleanupJobId);
    if (job && job.organizationId === access.organization._id) {
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

export const requestDownload = action({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args): Promise<{ url: string }> => {
    const authorized: {
      downloadPlaybackId?: string;
      downloadProviderAssetId?: string;
      provider: "fake" | "mux";
      providerAssetId: string;
      sourcePlaybackId: string;
    } = await ctx.runMutation(internal.videoMedia.authorizeDownload, args);
    let downloadable =
      authorized.downloadPlaybackId && authorized.downloadProviderAssetId
        ? {
            playbackId: authorized.downloadPlaybackId,
            providerAssetId: authorized.downloadProviderAssetId,
          }
        : undefined;
    if (!downloadable) {
      const created = await createVideoDownloadAsset({
        sourcePlaybackId: authorized.sourcePlaybackId,
      });
      try {
        const attached: {
          accepted: boolean;
          cleanupJobId?: import("./_generated/dataModel").Id<"videoProviderCleanupJobs">;
          playbackId: string;
          providerAssetId: string;
        } = await ctx.runMutation(internal.videoMedia.attachDownloadAsset, {
          ...args,
          ...created,
          provider: authorized.provider,
        });
        downloadable = {
          playbackId: attached.playbackId,
          providerAssetId: attached.providerAssetId,
        };
        if (attached.cleanupJobId) {
          await deleteVideoAsset(created.providerAssetId, authorized.provider);
          await ctx.runMutation(internal.videoMedia.completeProviderCleanup, {
            cleanupJobId: attached.cleanupJobId,
            organizationId: args.organizationId,
          });
        }
        if (!attached.accepted) testimonialUnavailable();
      } catch (error) {
        throw error;
      }
    }
    return {
      url: await getVideoDownloadUrl({
        ...downloadable,
        provider: authorized.provider,
      }),
    };
  },
});

export const prepareRemoval = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({
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
        .collect();
      if (cleanupJobs.length > 0) {
        return {
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
        alreadyDeleted: true,
        cleanupJobIds: [],
        providerAssets: [],
        providerUploads: [],
      };
    }

    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id ||
      testimonial.submissionType !== "video"
    ) {
      testimonialUnavailable();
    }
    if (testimonial.moderationStatus === "spam") testimonialUnavailable();
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!asset) testimonialUnavailable();

    const [cleanupJobs, projection, retryLinks, revisions] = await Promise.all([
      ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
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
        .collect(),
      ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_testimonial_status", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
    ]);
    if (projection) await ctx.db.delete(projection._id);
    const retryAssets = await Promise.all(
      retryLinks.map((retryLink) => ctx.db.get(retryLink.videoAssetId)),
    );
    const revisionAssets = await Promise.all(
      revisions.map((revision) =>
        revision.videoAssetId ? ctx.db.get(revision.videoAssetId) : null,
      ),
    );
    const allAssets = [asset, ...retryAssets, ...revisionAssets];
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
        providerUploadId: candidate!.providerUploadId,
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
    if (existing) {
      await ctx.db.patch(existing._id, {
        attempts: existing.attempts + 1,
        lastError: undefined,
        providerAssets,
        providerUploads,
        status: "requested",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("videoMediaDeletions", {
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
    return {
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

    const pendingCleanupJobs = await ctx.db
      .query("videoProviderCleanupJobs")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .collect();
    if (pendingCleanupJobs.length > 0) {
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
    const [
      asset,
      consent,
      deliveries,
      projection,
      retryLinks,
      revisions,
      replacementItems,
    ] = await Promise.all([
      ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
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
        .collect(),
      ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_testimonial_status", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
      ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
    ]);
    const retryAssets = await Promise.all(
      retryLinks.map((retryLink) => ctx.db.get(retryLink.videoAssetId)),
    );
    const revisionAssets = await Promise.all(
      revisions.map((revision) =>
        revision.videoAssetId ? ctx.db.get(revision.videoAssetId) : null,
      ),
    );
    if (projection) await ctx.db.delete(projection._id);
    for (const retryLink of retryLinks) await ctx.db.delete(retryLink._id);
    for (const revision of revisions) {
      await ctx.db.delete(revision._id);
      const reservation = await ctx.db.get(revision.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    for (const delivery of deliveries) await ctx.db.delete(delivery._id);
    for (const item of replacementItems) {
      await ctx.db.delete(item._id);
      const remaining = await ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_request", (index) =>
          index.eq("requestId", item.requestId),
        )
        .first();
      if (!remaining) {
        const request = await ctx.db.get(item.requestId);
        if (request) await ctx.db.delete(request._id);
      }
    }
    if (consent) await ctx.db.delete(consent._id);
    const appAssets = [asset, ...retryAssets, ...revisionAssets].filter(
      (candidate, index, all) =>
        candidate &&
        all.findIndex((other) => other?._id === candidate._id) === index,
    );
    for (const appAsset of appAssets) {
      if (!appAsset) continue;
      await ctx.db.delete(appAsset._id);
      const reservation = await ctx.db.get(appAsset.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    if (testimonial.avatarStorageId) {
      await ctx.storage.delete(testimonial.avatarStorageId);
    }
    await ctx.db.delete(testimonial._id);
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: access.principal.name,
      actorUserId: access.principal.actorId,
      eventType: "testimonial.deleted",
      organizationId: access.organization._id,
      previousValue: testimonial.moderationStatus,
      targetId: String(testimonial._id),
      targetLabel: "Deleted Testimonial",
      targetType: "testimonial",
    });
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
      for (const providerUpload of prepared.providerUploads) {
        await cancelVideoDirectUpload(
          providerUpload.providerUploadId,
          providerUpload.provider,
        );
      }
      for (const providerAsset of prepared.providerAssets) {
        await deleteVideoAsset(
          providerAsset.providerAssetId,
          providerAsset.provider,
        );
      }
      for (const cleanupJobId of prepared.cleanupJobIds) {
        await ctx.runMutation(internal.videoMedia.completeProviderCleanup, {
          cleanupJobId,
          organizationId: args.organizationId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.videoMedia.recordRemovalFailure, {
        ...args,
        error: message,
      });
      throw error;
    }
    return ctx.runMutation(internal.videoMedia.finalizeRemoval, args);
  },
});
