import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authzForOrganization } from "./authorization";
import { cancelStripeSubscription } from "./stripeBillingProvider";
import { requireOrganizationPermission } from "./security/organizationAccess";
import {
  requireRecentAuthentication,
  requireVerifiedPrincipal,
} from "./security/principal";
import { cancelVideoDirectUpload, deleteVideoAsset } from "./videoProvider";

const purgeBatchSize = 32;
const purgePhases = [
  "managementItems",
  "managementRequests",
  "videoRetryLinks",
  "videoRevisions",
  "videoDeletions",
  "videoCleanupJobs",
  "videoRetentions",
  "spamQuarantines",
  "collectionCredits",
  "publicationConsents",
  "submissionDeliveries",
  "avatarUploads",
  "testimonials",
  "videoReservations",
  "publicProjections",
  "projects",
  "invitations",
  "billingEmails",
  "billingTransitions",
  "stripeWebhookEvents",
  "stripeReconciliations",
  "stripeInvoiceFailures",
  "billingSubscriptions",
  "billingProfiles",
  "auditEvents",
  "memberships",
  "organization",
] as const;

function deletionUnavailable(): never {
  throw new ConvexError({
    code: "WORKSPACE_DELETION_UNAVAILABLE",
    message: "Workspace deletion is unavailable.",
  });
}

async function requireDeletionAccess(
  ctx: MutationCtx | QueryCtx,
  deletionId: Id<"workspaceDeletions">,
): Promise<{
  deletion: Doc<"workspaceDeletions">;
  principal: Awaited<ReturnType<typeof requireVerifiedPrincipal>>;
}> {
  const principal = await requireVerifiedPrincipal(ctx);
  const deletion = await ctx.db.get(deletionId);
  if (!deletion || deletion.actorUserId !== principal.actorId) {
    deletionUnavailable();
  }
  return { deletion, principal };
}

export const readDeletion = internalQuery({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.any(),
  handler: (ctx, args) => ctx.db.get(args.deletionId),
});

export const getStatus = query({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.object({
    lastError: v.optional(v.string()),
    phase: v.string(),
    status: v.union(
      v.literal("requested"),
      v.literal("failed"),
      v.literal("deleted"),
    ),
  }),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion || deletion.actorUserId !== principal.actorId) {
      deletionUnavailable();
    }
    return {
      lastError: deletion.lastError,
      phase: deletion.phase,
      status: deletion.status,
    };
  },
});

export const readExportData = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const [projects, testimonials, consents, memberships] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
      ctx.db
        .query("testimonials")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
      ctx.db
        .query("publicationConsents")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
    ]);
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        organization: access.organization,
        projects,
        testimonials,
        consents,
        memberships,
      },
      null,
      2,
    );
  },
});

export const exportData = action({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: (ctx, args): Promise<string> =>
    ctx.runQuery(internal.workspaceDeletion.readExportData, args),
});

export const prepare = internalMutation({
  args: {
    brandName: v.string(),
    irreversibleConfirmed: v.literal(true),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    deletionId: v.id("workspaceDeletions"),
    subscriptionIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireRecentAuthentication(ctx);
    const principal = await requireVerifiedPrincipal(ctx);
    const existing = await ctx.db
      .query("workspaceDeletions")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", args.organizationId),
      )
      .unique();
    if (existing) {
      if (existing.actorUserId !== principal.actorId) deletionUnavailable();
      return {
        deletionId: existing._id,
        subscriptionIds: existing.subscriptionIds ?? [],
      };
    }
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    if (args.brandName !== access.organization.name) {
      throw new ConvexError({
        code: "BRAND_NAME_MISMATCH",
        message: "Enter the exact Brand name to continue.",
      });
    }
    const now = Date.now();
    const subscriptions = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .collect();
    const subscriptionIds = subscriptions.map(
      (subscription) => subscription.stripeSubscriptionId,
    );
    const deletionId = await ctx.db.insert("workspaceDeletions", {
      actorUserId: principal.actorId,
      attempts: 1,
      createdAt: now,
      organizationId: access.organization._id,
      phase: purgePhases[0],
      status: "requested",
      subscriptionIds,
      updatedAt: now,
    });
    await ctx.db.patch(access.organization._id, {
      deletionStartedAt: now,
      updatedAt: now,
    });
    const projections = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .take(purgeBatchSize);
    for (const projection of projections) await ctx.db.delete(projection._id);
    return {
      deletionId,
      subscriptionIds,
    };
  },
});

const providerCleanupTarget = v.object({
  cleanupJobId: v.id("videoProviderCleanupJobs"),
  provider: v.union(v.literal("fake"), v.literal("mux")),
  providerAssetId: v.optional(v.string()),
  providerUploadId: v.optional(v.string()),
});

export const readProviderCleanupBatch = internalQuery({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.array(providerCleanupTarget),
  handler: async (ctx, args) => {
    const { deletion } = await requireDeletionAccess(ctx, args.deletionId);
    const jobs = await ctx.db
      .query("videoProviderCleanupJobs")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", deletion.organizationId),
      )
      .take(8);
    return jobs.map((job) => ({
      cleanupJobId: job._id,
      provider: job.provider,
      providerAssetId: job.providerAssetId,
      providerUploadId: job.providerUploadId,
    }));
  },
});

export const completeProviderCleanupBatch = internalMutation({
  args: {
    cleanupJobIds: v.array(v.id("videoProviderCleanupJobs")),
    deletionId: v.id("workspaceDeletions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDeletionAccess(ctx, args.deletionId);
    for (const cleanupJobId of args.cleanupJobIds) {
      const cleanupJob = await ctx.db.get(cleanupJobId);
      if (cleanupJob) await ctx.db.delete(cleanupJob._id);
    }
    return null;
  },
});

const mediaTarget = v.object({
  assetId: v.id("videoAssets"),
  provider: v.union(v.literal("fake"), v.literal("mux")),
  providerAssetIds: v.array(v.string()),
  providerUploadId: v.optional(v.string()),
});

export const readMediaBatch = internalQuery({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.array(mediaTarget),
  handler: async (ctx, args) => {
    const { deletion } = await requireDeletionAccess(ctx, args.deletionId);
    const assets = await ctx.db
      .query("videoAssets")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", deletion.organizationId),
      )
      .take(8);
    return assets.map((asset) => ({
      assetId: asset._id,
      provider: asset.provider,
      providerAssetIds: [
        ...(asset.providerAssetId ? [asset.providerAssetId] : []),
        ...(asset.downloadProviderAssetId
          ? [asset.downloadProviderAssetId]
          : []),
      ],
      providerUploadId: asset.providerAssetId
        ? undefined
        : asset.providerUploadId,
    }));
  },
});

export const completeMediaBatch = internalMutation({
  args: {
    assetIds: v.array(v.id("videoAssets")),
    deletionId: v.id("workspaceDeletions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDeletionAccess(ctx, args.deletionId);
    for (const assetId of args.assetIds) {
      const asset = await ctx.db.get(assetId);
      if (asset) await ctx.db.delete(asset._id);
    }
    return null;
  },
});

async function deletePhaseBatch(
  ctx: MutationCtx,
  deletionId: Id<"workspaceDeletions">,
) {
  const deletion = await ctx.db.get(deletionId);
  if (!deletion) deletionUnavailable();
  if (deletion.status === "deleted") return true;
  const phaseIndex = purgePhases.indexOf(deletion.phase as never);
  if (phaseIndex === -1) deletionUnavailable();
  const phase = purgePhases[phaseIndex] ?? "organization";
  const organizationId = deletion.organizationId;
  let records: Array<{
    _id: Id<TableNames>;
    [key: string]: unknown;
  }> = [];

  switch (phase) {
    case "managementItems":
      records = await ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "managementRequests":
      records = await ctx.db
        .query("managementLinkReplacementRequests")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "videoRetryLinks":
      records = await ctx.db
        .query("videoRetryLinks")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "videoRevisions":
      records = await ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "videoDeletions":
      records = await ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "videoCleanupJobs":
      records = await ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "videoRetentions":
      records = await ctx.db
        .query("videoDowngradeRetentions")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "spamQuarantines":
      records = await ctx.db
        .query("spamQuarantines")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "collectionCredits":
      records = await ctx.db
        .query("collectionCredits")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "publicationConsents":
      records = await ctx.db
        .query("publicationConsents")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "submissionDeliveries":
      records = await ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "avatarUploads":
      records = await ctx.db
        .query("submissionAvatarUploads")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      for (const record of records) {
        if (record.storageId)
          await ctx.storage.delete(record.storageId as Id<"_storage">);
      }
      break;
    case "testimonials":
      records = await ctx.db
        .query("testimonials")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      for (const record of records) {
        if (record.avatarStorageId)
          await ctx.storage.delete(record.avatarStorageId as Id<"_storage">);
      }
      break;
    case "videoReservations":
      records = await ctx.db
        .query("videoReservations")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "publicProjections":
      records = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "projects":
      records = await ctx.db
        .query("projects")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "invitations":
      records = await ctx.db
        .query("invitations")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "billingEmails":
      records = await ctx.db
        .query("billingLifecycleEmails")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "billingTransitions":
      records = await ctx.db
        .query("billingDowngradeTransitions")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "stripeWebhookEvents":
      for (const subscriptionId of deletion.subscriptionIds ?? []) {
        records = await ctx.db
          .query("stripeWebhookEvents")
          .withIndex("by_stripe_subscription", (i) =>
            i.eq("stripeSubscriptionId", subscriptionId),
          )
          .take(purgeBatchSize);
        if (records.length > 0) break;
      }
      break;
    case "stripeReconciliations":
      for (const subscriptionId of deletion.subscriptionIds ?? []) {
        records = await ctx.db
          .query("stripeSubscriptionReconciliations")
          .withIndex("by_stripe_subscription", (i) =>
            i.eq("stripeSubscriptionId", subscriptionId),
          )
          .take(purgeBatchSize);
        if (records.length > 0) break;
      }
      break;
    case "stripeInvoiceFailures":
      for (const subscriptionId of deletion.subscriptionIds ?? []) {
        records = await ctx.db
          .query("stripeInvoicePaymentFailures")
          .withIndex("by_stripe_subscription", (i) =>
            i.eq("stripeSubscriptionId", subscriptionId),
          )
          .take(purgeBatchSize);
        if (records.length > 0) break;
      }
      break;
    case "billingSubscriptions":
      records = await ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "billingProfiles":
      records = await ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "auditEvents":
      records = await ctx.db
        .query("auditEvents")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      break;
    case "memberships":
      records = await ctx.db
        .query("memberships")
        .withIndex("by_organization", (i) =>
          i.eq("organizationId", organizationId),
        )
        .take(purgeBatchSize);
      for (const record of records) {
        await authzForOrganization(String(organizationId)).revokeAllRoles(
          ctx,
          String(record.userId),
          undefined,
          deletion.actorUserId,
        );
      }
      break;
    case "organization": {
      const organization = await ctx.db.get(organizationId);
      if (organization?.logoStorageId) {
        await ctx.storage.delete(organization.logoStorageId);
      }
      if (organization) await ctx.db.delete(organization._id);
      await ctx.db.patch(deletion._id, {
        lastError: undefined,
        phase: "complete",
        status: "deleted",
        updatedAt: Date.now(),
      });
      return true;
    }
  }
  for (const record of records) await ctx.db.delete(record._id);
  if (records.length < purgeBatchSize) {
    await ctx.db.patch(deletion._id, {
      phase: purgePhases[phaseIndex + 1] ?? "organization",
      updatedAt: Date.now(),
    });
  }
  return false;
}

export const purgeBatch = internalMutation({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.boolean(),
  handler: (ctx, args) => deletePhaseBatch(ctx, args.deletionId),
});

export const recordFailure = internalMutation({
  args: { deletionId: v.id("workspaceDeletions"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion) return null;
    await ctx.db.patch(deletion._id, {
      attempts: deletion.attempts + 1,
      lastError: args.error.slice(0, 500),
      status: "failed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = action({
  args: {
    brandName: v.string(),
    irreversibleConfirmed: v.literal(true),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    deleted: v.boolean(),
    deletionId: v.id("workspaceDeletions"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ deleted: boolean; deletionId: Id<"workspaceDeletions"> }> => {
    const prepared = await ctx.runMutation(
      internal.workspaceDeletion.prepare,
      args,
    );
    try {
      for (const subscriptionId of prepared.subscriptionIds) {
        await cancelStripeSubscription(
          subscriptionId,
          `workspace_delete_${prepared.deletionId}_${subscriptionId}`,
        );
      }
      while (true) {
        const cleanupBatch = await ctx.runQuery(
          internal.workspaceDeletion.readProviderCleanupBatch,
          { deletionId: prepared.deletionId },
        );
        if (cleanupBatch.length === 0) break;
        for (const cleanup of cleanupBatch) {
          if (cleanup.providerAssetId) {
            await deleteVideoAsset(cleanup.providerAssetId, cleanup.provider);
          } else if (cleanup.providerUploadId) {
            await cancelVideoDirectUpload(
              cleanup.providerUploadId,
              cleanup.provider,
            );
          }
        }
        await ctx.runMutation(
          internal.workspaceDeletion.completeProviderCleanupBatch,
          {
            cleanupJobIds: cleanupBatch.map((cleanup) => cleanup.cleanupJobId),
            deletionId: prepared.deletionId,
          },
        );
      }
      while (true) {
        const batch = await ctx.runQuery(
          internal.workspaceDeletion.readMediaBatch,
          { deletionId: prepared.deletionId },
        );
        if (batch.length === 0) break;
        for (const media of batch) {
          if (media.providerUploadId) {
            await cancelVideoDirectUpload(
              media.providerUploadId,
              media.provider,
            );
          }
          for (const providerAssetId of media.providerAssetIds) {
            await deleteVideoAsset(providerAssetId, media.provider);
          }
        }
        await ctx.runMutation(internal.workspaceDeletion.completeMediaBatch, {
          assetIds: batch.map((media) => media.assetId),
          deletionId: prepared.deletionId,
        });
      }
      for (let guard = 0; guard < 10_000; guard += 1) {
        const done = await ctx.runMutation(
          internal.workspaceDeletion.purgeBatch,
          {
            deletionId: prepared.deletionId,
          },
        );
        if (done) {
          return { deleted: true, deletionId: prepared.deletionId };
        }
      }
      throw new Error("Workspace deletion did not converge.");
    } catch (error) {
      await ctx.runMutation(internal.workspaceDeletion.recordFailure, {
        deletionId: prepared.deletionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});
