import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { imageAssetMetadata } from "./domain/imageAsset";
import { deleteImageAsset, registerImageAsset } from "./imageAssetRegistry";
import { upsertPublicProjection } from "./publicProjection";

export const next = internalQuery({
  args: {
    limit: v.number(),
    retryFailed: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    ctx.db
      .query("imageAssetMigrationJobs")
      .withIndex("by_status", (q) =>
        q.eq("status", args.retryFailed ? "failed" : "queued"),
      )
      .take(args.limit),
});

export const fail = internalMutation({
  args: {
    diagnostic: v.string(),
    jobId: v.id("imageAssetMigrationJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || (job.status !== "queued" && job.status !== "failed"))
      return null;
    await ctx.db.patch(job._id, {
      attempts: job.attempts + 1,
      diagnostic: args.diagnostic,
      status: "failed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const commit = internalMutation({
  args: {
    jobId: v.id("imageAssetMigrationJobs"),
    metadata: imageAssetMetadata,
    replacementStorageId: v.id("_storage"),
  },
  returns: v.union(v.literal("complete"), v.literal("skipped")),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || (job.status !== "queued" && job.status !== "failed")) {
      await deleteImageAsset(ctx, args.replacementStorageId);
      return "skipped";
    }
    let currentStorageId;
    if (job.referenceTable === "userProfiles") {
      const id = ctx.db.normalizeId("userProfiles", job.referenceId);
      currentStorageId = id
        ? (await ctx.db.get(id))?.avatarStorageId
        : undefined;
    } else if (job.referenceTable === "organizations") {
      const id = ctx.db.normalizeId("organizations", job.referenceId);
      currentStorageId = id ? (await ctx.db.get(id))?.logoStorageId : undefined;
    } else if (job.referenceTable === "testimonialImages") {
      const id = ctx.db.normalizeId("testimonialImages", job.referenceId);
      currentStorageId = id ? (await ctx.db.get(id))?.storageId : undefined;
    } else {
      const id = ctx.db.normalizeId("testimonials", job.referenceId);
      const testimonial = id ? await ctx.db.get(id) : null;
      currentStorageId =
        job.referenceTable === "testimonialSubmitterPhoto"
          ? testimonial?.avatarStorageId
          : testimonial?.posterStorageId;
    }
    if (currentStorageId !== job.storageId) {
      await deleteImageAsset(ctx, args.replacementStorageId);
      await ctx.db.patch(job._id, {
        attempts: job.attempts + 1,
        diagnostic: "REFERENCE_CHANGED",
        status: "skipped",
        updatedAt: Date.now(),
      });
      return "skipped";
    }

    await registerImageAsset(
      ctx,
      args.replacementStorageId,
      args.metadata,
      job.kind,
      {
        organizationId: job.organizationId,
        ownerUserId: job.ownerUserId,
        testimonialId: job.testimonialId,
        testimonialImageId: job.testimonialImageId,
      },
    );
    if (job.referenceTable === "userProfiles") {
      const id = ctx.db.normalizeId("userProfiles", job.referenceId)!;
      await ctx.db.patch(id, { avatarStorageId: args.replacementStorageId });
    } else if (job.referenceTable === "organizations") {
      const id = ctx.db.normalizeId("organizations", job.referenceId)!;
      await ctx.db.patch(id, {
        logoStorageId: args.replacementStorageId,
        updatedAt: Date.now(),
      });
    } else if (job.referenceTable === "testimonialImages") {
      const id = ctx.db.normalizeId("testimonialImages", job.referenceId)!;
      await ctx.db.patch(id, { storageId: args.replacementStorageId });
    } else {
      const id = ctx.db.normalizeId("testimonials", job.referenceId)!;
      const testimonial = (await ctx.db.get(id))!;
      const patch =
        job.referenceTable === "testimonialSubmitterPhoto"
          ? {
              avatarStorageId: args.replacementStorageId,
              updatedAt: Date.now(),
            }
          : {
              posterStorageId: args.replacementStorageId,
              updatedAt: Date.now(),
            };
      await ctx.db.patch(id, patch);
      const projection = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) => q.eq("testimonialId", id))
        .unique();
      if (projection)
        await upsertPublicProjection(
          ctx,
          { ...testimonial, ...patch },
          projection.publishedAt,
        );
    }
    await deleteImageAsset(ctx, job.storageId);
    await ctx.db.patch(job._id, {
      attempts: job.attempts + 1,
      diagnostic: undefined,
      replacementStorageId: args.replacementStorageId,
      status: "complete",
      updatedAt: Date.now(),
    });
    return "complete";
  },
});
