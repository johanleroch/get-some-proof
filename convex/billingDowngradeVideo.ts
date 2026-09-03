import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { deleteVideoAsset } from "./videoProvider";

const MAXIMUM_RETRY_MS = 60 * 60 * 1_000;
const DELETION_LEASE_MS = 5 * 60 * 1_000;

export const reserveDeletion = internalMutation({
  args: {
    leaseId: v.string(),
    retentionId: v.id("videoDowngradeRetentions"),
  },
  returns: v.union(
    v.null(),
    v.object({
      downloadProviderAssetId: v.optional(v.string()),
      provider: v.union(v.literal("fake"), v.literal("mux")),
      providerAssetId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const retention = await ctx.db.get(args.retentionId);
    if (!retention || retention.status === "deleted") {
      return null;
    }
    if (Date.now() < retention.expiresAt) {
      await ctx.scheduler.runAt(
        retention.expiresAt,
        internal.billingDowngradeVideo.deleteRetainedVideo,
        { retentionId: args.retentionId },
      );
      return null;
    }
    if (
      retention.status === "deleting" &&
      (retention.deletionLeaseExpiresAt ?? 0) > Date.now()
    ) {
      return null;
    }
    const asset = await ctx.db.get(retention.videoAssetId);
    if (!asset) {
      await ctx.db.patch(retention._id, {
        deletedAt: Date.now(),
        deletionLeaseExpiresAt: undefined,
        deletionLeaseId: undefined,
        lastError: undefined,
        status: "deleted",
        updatedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.patch(retention._id, {
      attempts: retention.attempts + 1,
      deletionLeaseExpiresAt: Date.now() + DELETION_LEASE_MS,
      deletionLeaseId: args.leaseId,
      lastError: undefined,
      status: "deleting",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      DELETION_LEASE_MS,
      internal.billingDowngradeVideo.deleteRetainedVideo,
      { retentionId: retention._id },
    );
    return {
      downloadProviderAssetId: asset.downloadProviderAssetId,
      provider: asset.provider,
      providerAssetId: asset.providerAssetId,
    };
  },
});

export const completeDeletion = internalMutation({
  args: {
    leaseId: v.string(),
    retentionId: v.id("videoDowngradeRetentions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retention = await ctx.db.get(args.retentionId);
    if (
      !retention ||
      retention.status !== "deleting" ||
      retention.deletionLeaseId !== args.leaseId
    ) {
      return null;
    }
    const asset = await ctx.db.get(retention.videoAssetId);
    if (asset) {
      const reservation = await ctx.db.get(asset.reservationId);
      await ctx.db.delete(asset._id);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    await ctx.db.patch(retention._id, {
      deletedAt: Date.now(),
      deletionLeaseExpiresAt: undefined,
      deletionLeaseId: undefined,
      lastError: undefined,
      status: "deleted",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordDeletionFailure = internalMutation({
  args: {
    error: v.string(),
    leaseId: v.string(),
    retentionId: v.id("videoDowngradeRetentions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retention = await ctx.db.get(args.retentionId);
    if (
      !retention ||
      retention.status !== "deleting" ||
      retention.deletionLeaseId !== args.leaseId
    ) {
      return null;
    }
    await ctx.db.patch(retention._id, {
      deletionLeaseExpiresAt: undefined,
      deletionLeaseId: undefined,
      lastError: args.error,
      status: "retained",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      Math.min(MAXIMUM_RETRY_MS, 1_000 * 2 ** Math.min(retention.attempts, 12)),
      internal.billingDowngradeVideo.deleteRetainedVideo,
      { retentionId: retention._id },
    );
    return null;
  },
});

export const deleteRetainedVideo = internalAction({
  args: { retentionId: v.id("videoDowngradeRetentions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaseId = crypto.randomUUID();
    const retention = await ctx.runMutation(
      internal.billingDowngradeVideo.reserveDeletion,
      { ...args, leaseId },
    );
    if (!retention) return null;
    try {
      const targets = new Set(
        [retention.providerAssetId, retention.downloadProviderAssetId].filter(
          (id): id is string => Boolean(id),
        ),
      );
      await Promise.all(
        [...targets].map((providerAssetId) =>
          deleteVideoAsset(providerAssetId, retention.provider),
        ),
      );
      await ctx.runMutation(internal.billingDowngradeVideo.completeDeletion, {
        ...args,
        leaseId,
      });
    } catch (error) {
      await ctx.runMutation(
        internal.billingDowngradeVideo.recordDeletionFailure,
        {
          ...args,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Retained video deletion failed.",
          leaseId,
        },
      );
    }
    return null;
  },
});
