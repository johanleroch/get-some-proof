import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  action,
  internalAction,
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
): Promise<Doc<"workspaceDeletions">> {
  const deletion = await ctx.db.get(deletionId);
  if (!deletion) deletionUnavailable();
  return deletion;
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

export const getByOrganizationSlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      brandName: v.string(),
      deletionId: v.id("workspaceDeletions"),
      lastError: v.optional(v.string()),
      phase: v.string(),
      organizationId: v.id("organizations"),
      status: v.union(
        v.literal("requested"),
        v.literal("failed"),
        v.literal("deleted"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", args.slug))
      .unique();
    if (!organization?.deletionStartedAt) return null;
    const deletion = await ctx.db
      .query("workspaceDeletions")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organization._id),
      )
      .unique();
    if (!deletion || deletion.actorUserId !== principal.actorId) return null;
    return {
      brandName: organization.name,
      deletionId: deletion._id,
      lastError: deletion.lastError,
      phase: deletion.phase,
      organizationId: organization._id,
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
      for (const subscriptionId of existing.subscriptionIds ?? []) {
        const marker = await ctx.db
          .query("workspaceDeletionSubscriptions")
          .withIndex("by_stripe_subscription", (index) =>
            index.eq("stripeSubscriptionId", subscriptionId),
          )
          .unique();
        if (!marker) {
          await ctx.db.insert("workspaceDeletionSubscriptions", {
            createdAt: Date.now(),
            deletionId: existing._id,
            stripeSubscriptionId: subscriptionId,
          });
        }
      }
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
      phase: "providerCleanup",
      status: "requested",
      subscriptionIds,
      updatedAt: now,
    });
    for (const subscriptionId of subscriptionIds) {
      await ctx.db.insert("workspaceDeletionSubscriptions", {
        createdAt: now,
        deletionId,
        stripeSubscriptionId: subscriptionId,
      });
    }
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
    const deletion = await requireDeletionAccess(ctx, args.deletionId);
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
    const deletion = await requireDeletionAccess(ctx, args.deletionId);
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

const processingLeaseMs = 2 * 60 * 1_000;

export const readPendingSubscription = internalQuery({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.union(
    v.null(),
    v.object({
      markerId: v.id("workspaceDeletionSubscriptions"),
      stripeSubscriptionId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireDeletionAccess(ctx, args.deletionId);
    const markers = await ctx.db
      .query("workspaceDeletionSubscriptions")
      .withIndex("by_deletion", (index) =>
        index.eq("deletionId", args.deletionId),
      )
      .collect();
    const marker = markers.find((candidate) => !candidate.canceledAt);
    return marker
      ? {
          markerId: marker._id,
          stripeSubscriptionId: marker.stripeSubscriptionId,
        }
      : null;
  },
});

export const completeSubscriptionCancellation = internalMutation({
  args: {
    deletionId: v.id("workspaceDeletions"),
    markerId: v.id("workspaceDeletionSubscriptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireDeletionAccess(ctx, args.deletionId);
    const marker = await ctx.db.get(args.markerId);
    if (marker?.deletionId === args.deletionId && !marker.canceledAt) {
      await ctx.db.patch(marker._id, { canceledAt: Date.now() });
    }
    return null;
  },
});

export const claimDeletion = internalMutation({
  args: {
    deletionId: v.id("workspaceDeletions"),
    leaseId: v.string(),
  },
  returns: v.union(v.null(), v.object({ phase: v.string() })),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion) return null;
    const pendingSubscription = await ctx.db
      .query("workspaceDeletionSubscriptions")
      .withIndex("by_deletion", (index) => index.eq("deletionId", deletion._id))
      .filter((filter) => filter.eq(filter.field("canceledAt"), undefined))
      .first();
    if (deletion.status === "deleted" && !pendingSubscription) return null;
    if (
      deletion.leaseId &&
      deletion.leaseExpiresAt &&
      deletion.leaseExpiresAt > Date.now()
    ) {
      return null;
    }
    const leaseExpiresAt = Date.now() + processingLeaseMs;
    await ctx.db.patch(deletion._id, {
      lastError: undefined,
      leaseExpiresAt,
      leaseId: args.leaseId,
      nextRetryAt: undefined,
      status: "requested",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAt(
      leaseExpiresAt + 1_000,
      internal.workspaceDeletion.processDeletion,
      { deletionId: deletion._id },
    );
    return { phase: deletion.phase };
  },
});

export const advanceDeletionPhase = internalMutation({
  args: {
    deletionId: v.id("workspaceDeletions"),
    leaseId: v.string(),
    phase: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion || deletion.leaseId !== args.leaseId) return null;
    await ctx.db.patch(deletion._id, {
      phase: args.phase,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const releaseDeletion = internalMutation({
  args: {
    deletionId: v.id("workspaceDeletions"),
    leaseId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion || deletion.leaseId !== args.leaseId) return null;
    const pendingSubscription = await ctx.db
      .query("workspaceDeletionSubscriptions")
      .withIndex("by_deletion", (index) => index.eq("deletionId", deletion._id))
      .filter((filter) => filter.eq(filter.field("canceledAt"), undefined))
      .first();
    const completed = deletion.phase === "complete" && !pendingSubscription;
    await ctx.db.patch(deletion._id, {
      lastError: completed ? undefined : deletion.lastError,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      status: completed ? "deleted" : deletion.status,
      updatedAt: Date.now(),
    });
    if (!completed && deletion.status !== "deleted") {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaceDeletion.processDeletion,
        { deletionId: deletion._id },
      );
    }
    return null;
  },
});

export const recordFailure = internalMutation({
  args: {
    deletionId: v.id("workspaceDeletions"),
    error: v.string(),
    leaseId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion || deletion.leaseId !== args.leaseId) return null;
    const attempts = deletion.attempts + 1;
    const retryDelayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
    await ctx.db.patch(deletion._id, {
      attempts,
      lastError: args.error.slice(0, 500),
      leaseExpiresAt: undefined,
      leaseId: undefined,
      nextRetryAt: Date.now() + retryDelayMs,
      status: "failed",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      retryDelayMs,
      internal.workspaceDeletion.processDeletion,
      { deletionId: deletion._id },
    );
    return null;
  },
});

export const scheduleDeletion = internalMutation({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion) return null;
    await ctx.scheduler.runAfter(
      0,
      internal.workspaceDeletion.processDeletion,
      { deletionId: deletion._id },
    );
    return null;
  },
});

export const processDeletion = internalAction({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const leaseId = crypto.randomUUID();
    const claim = await ctx.runMutation(
      internal.workspaceDeletion.claimDeletion,
      { deletionId: args.deletionId, leaseId },
    );
    if (!claim) return null;
    try {
      const pendingSubscription = await ctx.runQuery(
        internal.workspaceDeletion.readPendingSubscription,
        { deletionId: args.deletionId },
      );
      if (pendingSubscription) {
        await cancelStripeSubscription(
          pendingSubscription.stripeSubscriptionId,
          `workspace_delete_${args.deletionId}_${pendingSubscription.stripeSubscriptionId}`,
        );
        await ctx.runMutation(
          internal.workspaceDeletion.completeSubscriptionCancellation,
          {
            deletionId: args.deletionId,
            markerId: pendingSubscription.markerId,
          },
        );
      } else if (claim.phase === "providerCleanup") {
        const cleanupBatch = await ctx.runQuery(
          internal.workspaceDeletion.readProviderCleanupBatch,
          { deletionId: args.deletionId },
        );
        if (cleanupBatch.length === 0) {
          await ctx.runMutation(
            internal.workspaceDeletion.advanceDeletionPhase,
            { deletionId: args.deletionId, leaseId, phase: "media" },
          );
        } else {
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
              cleanupJobIds: cleanupBatch.map(
                (cleanup) => cleanup.cleanupJobId,
              ),
              deletionId: args.deletionId,
            },
          );
        }
      } else if (claim.phase === "media") {
        const mediaBatch = await ctx.runQuery(
          internal.workspaceDeletion.readMediaBatch,
          { deletionId: args.deletionId },
        );
        if (mediaBatch.length === 0) {
          await ctx.runMutation(
            internal.workspaceDeletion.advanceDeletionPhase,
            { deletionId: args.deletionId, leaseId, phase: purgePhases[0] },
          );
        } else {
          for (const media of mediaBatch) {
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
            assetIds: mediaBatch.map((media) => media.assetId),
            deletionId: args.deletionId,
          });
        }
      } else if (claim.phase !== "complete") {
        await ctx.runMutation(internal.workspaceDeletion.purgeBatch, {
          deletionId: args.deletionId,
        });
      }
      await ctx.runMutation(internal.workspaceDeletion.releaseDeletion, {
        deletionId: args.deletionId,
        leaseId,
      });
    } catch (error) {
      await ctx.runMutation(internal.workspaceDeletion.recordFailure, {
        deletionId: args.deletionId,
        error: error instanceof Error ? error.message : String(error),
        leaseId,
      });
    }
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
    await ctx.runMutation(internal.workspaceDeletion.scheduleDeletion, {
      deletionId: prepared.deletionId,
    });
    const deletion = await ctx.runQuery(
      internal.workspaceDeletion.readDeletion,
      {
        deletionId: prepared.deletionId,
      },
    );
    return {
      deleted: deletion?.status === "deleted",
      deletionId: prepared.deletionId,
    };
  },
});
