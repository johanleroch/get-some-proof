import {
  emptyMediaProgress,
  mediaDeletionProgress,
} from "./domain/mediaDeletionProgress";
import { registerImages, assertMediaDeleted } from "./deletionMedia";
import { deleteNextMedia } from "./deletionMediaActions";
import { processWorkspaceDeletion } from "./workspaceDeletion";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  requireRecentAuthentication,
  requireVerifiedPrincipal,
} from "./security/principal";
import { cancelStripeSubscription } from "./stripeBillingProvider";

const batchSize = 32;
const leaseMs = 120_000;
const stepValidator = v.union(
  v.null(),
  v.object({ kind: v.literal("continue") }),
  v.object({
    kind: v.literal("inventoryProject"),
    deletionId: v.id("workspaceDeletions"),
  }),
  v.object({ kind: v.literal("accountMedia") }),
  v.object({
    kind: v.literal("subscription"),
    stripeSubscriptionId: v.string(),
    markerId: v.id("accountDeletionSubscriptions"),
  }),
  v.object({
    kind: v.literal("project"),
    organizationId: v.id("organizations"),
  }),
);

export const remove = mutation({
  args: {
    confirmation: v.literal("DELETE ACCOUNT"),
    irreversibleConfirmed: v.literal(true),
  },
  returns: v.id("accountDeletions"),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    if (!account)
      throw new ConvexError({
        code: "ACCOUNT_UNAVAILABLE",
        message: "Account unavailable.",
      });
    const existing = await ctx.db
      .query("accountDeletions")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    if (existing) return existing._id;
    await requireRecentAuthentication(ctx);
    const now = Date.now();
    await ctx.db.patch(account._id, { deletionStartedAt: now, updatedAt: now });
    const deletionId = await ctx.db.insert("accountDeletions", {
      accountId: account._id,
      ownerUserId: principal.actorId,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.accountDeletion.processDeletion, {
      deletionId,
    });
    return deletionId;
  },
});

export const getMine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal("requested"),
        v.literal("failed"),
        v.literal("deleted"),
      ),
      mediaProgress: v.optional(mediaDeletionProgress),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    const deletion = account
      ? await ctx.db
          .query("accountDeletions")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .unique()
      : null;
    return deletion
      ? {
          status: deletion.status,
          lastError: deletion.lastError,
          mediaProgress: deletion.mediaProgress,
        }
      : null;
  },
});

export const claim = internalMutation({
  args: { deletionId: v.id("accountDeletions"), leaseId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (
      !deletion ||
      deletion.status === "deleted" ||
      (deletion.leaseExpiresAt ?? 0) > Date.now()
    )
      return false;
    await ctx.db.patch(deletion._id, {
      leaseId: args.leaseId,
      leaseExpiresAt: Date.now() + leaseMs,
      status: "requested",
      updatedAt: Date.now(),
    });
    // A crashed worker is retried after the lease; external cancellation uses a stable key.
    await ctx.scheduler.runAfter(
      leaseMs + 1_000,
      internal.accountDeletion.processDeletion,
      { deletionId: deletion._id },
    );
    return true;
  },
});

export const advance = internalMutation({
  args: { deletionId: v.id("accountDeletions"), leaseId: v.string() },
  returns: stepValidator,
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (
      !deletion ||
      deletion.leaseId !== args.leaseId ||
      deletion.status === "deleted"
    )
      return null;
    const accountId = deletion.accountId;
    const pending = await ctx.db
      .query("accountDeletionSubscriptions")
      .withIndex("by_account_pending", (q) =>
        q.eq("accountId", accountId).eq("canceledAt", undefined),
      )
      .first();
    if (pending)
      return {
        kind: "subscription" as const,
        markerId: pending._id,
        stripeSubscriptionId: pending.stripeSubscriptionId,
      };
    const subscription = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .first();
    if (subscription) {
      const marker = await ctx.db
        .query("accountDeletionSubscriptions")
        .withIndex("by_subscription", (q) =>
          q.eq("stripeSubscriptionId", subscription.stripeSubscriptionId),
        )
        .unique();
      if (!marker) {
        const markerId = await ctx.db.insert("accountDeletionSubscriptions", {
          accountId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        });
        return {
          kind: "subscription" as const,
          markerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        };
      }
      const [events, reconciliations, failures] = await Promise.all([
        ctx.db
          .query("stripeWebhookEvents")
          .withIndex("by_stripe_subscription", (q) =>
            q.eq("stripeSubscriptionId", subscription.stripeSubscriptionId),
          )
          .take(batchSize),
        ctx.db
          .query("stripeSubscriptionReconciliations")
          .withIndex("by_stripe_subscription", (q) =>
            q.eq("stripeSubscriptionId", subscription.stripeSubscriptionId),
          )
          .take(batchSize),
        ctx.db
          .query("stripeInvoicePaymentFailures")
          .withIndex("by_stripe_subscription", (q) =>
            q.eq("stripeSubscriptionId", subscription.stripeSubscriptionId),
          )
          .take(batchSize),
      ]);
      for (const record of [...events, ...reconciliations, ...failures])
        await ctx.db.delete(record._id);
      if (events.length + reconciliations.length + failures.length === 0)
        await ctx.db.delete(subscription._id);
      return { kind: "continue" as const };
    }
    if (!deletion.projectsInventoried) {
      const page = await ctx.db
        .query("organizations")
        .withIndex("by_account_open", (q) => q.eq("accountId", accountId))
        .paginate({ cursor: deletion.inventoryCursor ?? null, numItems: 16 });
      for (const project of page.page)
        await ctx.runMutation(
          internal.workspaceDeletion.prepareAccountProject,
          { accountDeletionId: deletion._id, organizationId: project._id },
        );
      await ctx.db.patch(deletion._id, {
        projectsInventoried: page.isDone,
        inventoryCursor: page.isDone ? undefined : page.continueCursor,
      });
      return { kind: "continue" as const };
    }
    const inventory = await ctx.db
      .query("workspaceDeletions")
      .withIndex("by_account_inventory", (q) =>
        q
          .eq("accountDeletionId", deletion._id)
          .eq("mediaInventoryComplete", false),
      )
      .first();
    if (inventory)
      return { kind: "inventoryProject" as const, deletionId: inventory._id };
    if (!deletion.mediaProgress?.inventoryComplete) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", deletion.ownerUserId))
        .unique();
      await registerImages(ctx, deletion._id, profile);
      const fresh = await ctx.db.get(deletion._id);
      await ctx.db.patch(deletion._id, {
        mediaProgress: {
          ...(fresh?.mediaProgress ?? emptyMediaProgress()),
          inventoryComplete: true,
        },
      });
      return { kind: "continue" as const };
    }
    const ownMedia = await ctx.db
      .query("deletionMediaTargets")
      .withIndex("by_deletion_pending", (q) =>
        q.eq("deletionId", deletion._id).eq("deletedAt", undefined),
      )
      .first();
    if (ownMedia) return { kind: "accountMedia" as const };
    const project = await ctx.db
      .query("organizations")
      .withIndex("by_account_open", (q) => q.eq("accountId", accountId))
      .first();
    if (project)
      return { kind: "project" as const, organizationId: project._id };
    const credits = await ctx.db
      .query("collectionCredits")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .take(batchSize);
    if (credits.length) {
      for (const credit of credits) await ctx.db.delete(credit._id);
      return { kind: "continue" as const };
    }
    const restorations = await ctx.db
      .query("accountSpamRestorations")
      .withIndex("by_account_reported_at", (q) => q.eq("accountId", accountId))
      .take(batchSize);
    if (restorations.length) {
      for (const restoration of restorations)
        await ctx.db.delete(restoration._id);
      return { kind: "continue" as const };
    }
    const transition = await ctx.db
      .query("billingDowngradeTransitions")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .first();
    if (transition) {
      const emails = await ctx.db
        .query("billingLifecycleEmails")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", transition.organizationId),
        )
        .take(batchSize);
      for (const email of emails) await ctx.db.delete(email._id);
      if (!emails.length) await ctx.db.delete(transition._id);
      return { kind: "continue" as const };
    }
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_account", (q) => q.eq("accountId", accountId))
      .first();
    if (profile) {
      await ctx.db.delete(profile._id);
      return { kind: "continue" as const };
    }
    await assertMediaDeleted(ctx, deletion._id);
    const verifications = await ctx.db
      .query("directImageVerifications")
      .withIndex("by_owner_user_id", (q) =>
        q.eq("ownerUserId", deletion.ownerUserId),
      )
      .take(batchSize);
    if (verifications.length) {
      await Promise.all(
        verifications.map(async (verification) => {
          await ctx.storage.delete(verification.storageId);
          await ctx.db.delete(verification._id);
        }),
      );
      return { kind: "continue" as const };
    }
    const migrationJobs = await ctx.db
      .query("imageAssetMigrationJobs")
      .withIndex("by_owner_user_id", (q) =>
        q.eq("ownerUserId", deletion.ownerUserId),
      )
      .take(batchSize);
    if (migrationJobs.length) {
      await Promise.all(
        migrationJobs.map(async (job) => {
          await ctx.storage.delete(job.storageId);
          if (job.replacementStorageId)
            await ctx.storage.delete(job.replacementStorageId);
          await ctx.db.delete(job._id);
        }),
      );
      return { kind: "continue" as const };
    }
    const imageAssets = await ctx.db
      .query("imageAssets")
      .withIndex("by_owner_user_and_kind", (q) =>
        q.eq("ownerUserId", deletion.ownerUserId),
      )
      .take(batchSize);
    if (imageAssets.length) {
      await Promise.all(
        imageAssets.map(async (asset) => {
          if (asset.storageId) await ctx.storage.delete(asset.storageId);
          await ctx.db.delete(asset._id);
        }),
      );
      return { kind: "continue" as const };
    }
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", deletion.ownerUserId))
      .unique();
    if (userProfile) await ctx.db.delete(userProfile._id);
    // Keep the minimal closure tombstone to reject late webhooks and new writes.
    await ctx.db.patch(accountId, {
      selectedFreeProjectId: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(deletion._id, {
      status: "deleted",
      lastError: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const confirmCancellation = internalMutation({
  args: {
    deletionId: v.id("accountDeletions"),
    markerId: v.id("accountDeletionSubscriptions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    const marker = await ctx.db.get(args.markerId);
    if (
      deletion &&
      marker?.accountId === deletion.accountId &&
      marker.canceledAt === undefined
    )
      await ctx.db.patch(marker._id, { canceledAt: Date.now() });
    return null;
  },
});

export const release = internalMutation({
  args: {
    deletionId: v.id("accountDeletions"),
    leaseId: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletion = await ctx.db.get(args.deletionId);
    if (!deletion || deletion.leaseId !== args.leaseId) return null;
    await ctx.db.patch(deletion._id, {
      leaseId: undefined,
      leaseExpiresAt: undefined,
      lastError: args.error?.slice(0, 500),
      status: args.error ? "failed" : deletion.status,
      updatedAt: Date.now(),
    });
    if (deletion.status !== "deleted")
      await ctx.scheduler.runAfter(
        args.error ? 30_000 : 1_000,
        internal.accountDeletion.processDeletion,
        { deletionId: deletion._id },
      );
    return null;
  },
});

export const processDeletion = internalAction({
  args: { deletionId: v.id("accountDeletions") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const leaseId = crypto.randomUUID();
    if (
      !(await ctx.runMutation(internal.accountDeletion.claim, {
        ...args,
        leaseId,
      }))
    )
      return null;
    let error: string | undefined;
    try {
      const step = await ctx.runMutation(internal.accountDeletion.advance, {
        ...args,
        leaseId,
      });
      if (step?.kind === "subscription") {
        await cancelStripeSubscription(
          step.stripeSubscriptionId,
          `account_delete_${args.deletionId}_${step.stripeSubscriptionId}`,
        );
        await ctx.runMutation(internal.accountDeletion.confirmCancellation, {
          deletionId: args.deletionId,
          markerId: step.markerId,
        });
      } else if (step?.kind === "inventoryProject") {
        await ctx.runMutation(internal.workspaceDeletionInventory.advance, {
          deletionId: step.deletionId,
        });
      } else if (step?.kind === "accountMedia") {
        await deleteNextMedia(ctx, args.deletionId);
      } else if (step?.kind === "project") {
        const deletionId: Id<"workspaceDeletions"> = await ctx.runMutation(
          internal.workspaceDeletion.prepareAccountProject,
          {
            accountDeletionId: args.deletionId,
            organizationId: step.organizationId,
          },
        );
        await processWorkspaceDeletion(ctx, { deletionId });
        const progress = await ctx.runQuery(
          internal.workspaceDeletion.readDeletion,
          { deletionId },
        );
        if (progress?.status === "failed")
          throw new Error("Project media cleanup needs another attempt.");
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    await ctx.runMutation(internal.accountDeletion.release, {
      ...args,
      leaseId,
      ...(error ? { error } : {}),
    });
    return null;
  },
});
