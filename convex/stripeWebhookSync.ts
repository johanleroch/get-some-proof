import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { syncBillingDowngradeLifecycle } from "./billingDowngrade";

const maximumScheduleHopSeconds = 20 * 24 * 60 * 60;
const maximumReconciliationRetryMs = 15 * 60_000;
const paymentGraceSeconds = 7 * 24 * 60 * 60;

const outcomeValidator = v.union(
  v.literal("applied"),
  v.literal("duplicate"),
  v.literal("stale"),
  v.literal("ignored"),
  v.literal("queued"),
);

const restrictionPriority = new Map<string, number>([
  ["active", 0],
  ["trialing", 1],
  ["past_due", 2],
  ["incomplete", 3],
  ["paused", 4],
  ["unpaid", 5],
  ["canceled", 6],
  ["incomplete_expired", 7],
]);

function statusRestriction(status: string) {
  return restrictionPriority.get(status) ?? 100;
}

function entitlementDeadline(snapshot: {
  currentPeriodEnd: number;
  status: string;
  statusChangedAt?: number;
}) {
  if (snapshot.status === "active") return snapshot.currentPeriodEnd;
  if (
    snapshot.status === "past_due" &&
    snapshot.statusChangedAt !== undefined
  ) {
    return snapshot.statusChangedAt + paymentGraceSeconds;
  }
  return null;
}

async function subscriptionDeletionStarted(
  ctx: MutationCtx,
  stripeSubscriptionId: string,
  organizationId?: string,
) {
  const marker = await ctx.db
    .query("workspaceDeletionSubscriptions")
    .withIndex("by_stripe_subscription", (index) =>
      index.eq("stripeSubscriptionId", stripeSubscriptionId),
    )
    .unique();
  if (marker) {
    if (!marker.canceledAt) {
      await ctx.scheduler.runAfter(
        0,
        internal.workspaceDeletion.processDeletion,
        { deletionId: marker.deletionId },
      );
    }
    return true;
  }
  const normalizedOrganizationId = organizationId
    ? ctx.db.normalizeId("organizations", organizationId)
    : null;
  if (!normalizedOrganizationId) return false;
  const deletion = await ctx.db
    .query("workspaceDeletions")
    .withIndex("by_organization", (index) =>
      index.eq("organizationId", normalizedOrganizationId),
    )
    .unique();
  if (!deletion) return false;
  await ctx.db.insert("workspaceDeletionSubscriptions", {
    createdAt: Date.now(),
    deletionId: deletion._id,
    stripeSubscriptionId,
  });
  const phasesAfterWebhookPurge = new Set([
    "stripeWebhookEvents",
    "stripeReconciliations",
    "stripeInvoiceFailures",
    "billingSubscriptions",
    "billingProfiles",
    "auditEvents",
    "memberships",
    "organization",
    "complete",
  ]);
  await ctx.db.patch(deletion._id, {
    lastError: undefined,
    nextRetryAt: undefined,
    phase: phasesAfterWebhookPurge.has(deletion.phase)
      ? "stripeWebhookEvents"
      : deletion.phase,
    status: "requested",
    subscriptionIds: Array.from(
      new Set([...(deletion.subscriptionIds ?? []), stripeSubscriptionId]),
    ),
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.workspaceDeletion.processDeletion, {
    deletionId: deletion._id,
  });
  return true;
}

async function scheduleEntitlementDeadline(
  ctx: MutationCtx,
  stripeSubscriptionId: string,
  deadline: number,
) {
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const scheduledArgs = { deadline, stripeSubscriptionId };
  if (deadline <= nowSeconds) {
    await ctx.scheduler.runAfter(
      0,
      internal.stripeWebhookSync.invalidateEntitlementAtDeadline,
      scheduledArgs,
    );
    return;
  }
  await ctx.scheduler.runAt(
    Math.min(deadline, nowSeconds + maximumScheduleHopSeconds) * 1_000,
    internal.stripeWebhookSync.invalidateEntitlementAtDeadline,
    scheduledArgs,
  );
}

export const invalidateEntitlementAtDeadline = internalMutation({
  args: {
    deadline: v.number(),
    stripeSubscriptionId: v.string(),
  },
  returns: v.object({ invalidated: v.boolean() }),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!subscription || entitlementDeadline(subscription) !== args.deadline) {
      return { invalidated: false };
    }
    if (Date.now() < args.deadline * 1_000) {
      await scheduleEntitlementDeadline(
        ctx,
        args.stripeSubscriptionId,
        args.deadline,
      );
      return { invalidated: false };
    }
    await ctx.db.patch(subscription._id, { updatedAt: Date.now() });
    return { invalidated: true };
  },
});

export const readReconciliationRequest = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("stripeSubscriptionReconciliations")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique(),
});

export const readInvoicePaymentFailure = internalQuery({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("stripeInvoicePaymentFailures")
      .withIndex("by_stripe_invoice", (index) =>
        index.eq("stripeInvoiceId", args.stripeInvoiceId),
      )
      .unique(),
});

export const enqueueSubscriptionEvent = internalMutation({
  args: {
    eventCreated: v.number(),
    eventId: v.string(),
    eventType: v.string(),
    paymentFailureInvoiceId: v.optional(v.string()),
    paymentFailedAt: v.optional(v.number()),
    stripeSubscriptionId: v.string(),
  },
  returns: v.object({
    generation: v.optional(v.number()),
    outcome: outcomeValidator,
  }),
  handler: async (ctx, args) => {
    if (await subscriptionDeletionStarted(ctx, args.stripeSubscriptionId)) {
      return { outcome: "ignored" as const };
    }
    const priorEvent = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_stripe_event", (index) =>
        index.eq("stripeEventId", args.eventId),
      )
      .unique();
    if (priorEvent) return { outcome: "duplicate" as const };

    const existing = await ctx.db
      .query("stripeSubscriptionReconciliations")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    const generation = (existing?.generation ?? 0) + 1;
    const hasIncomingFailure =
      args.paymentFailureInvoiceId !== undefined &&
      args.paymentFailedAt !== undefined;
    if (hasIncomingFailure) {
      const invoiceFailure = await ctx.db
        .query("stripeInvoicePaymentFailures")
        .withIndex("by_stripe_invoice", (index) =>
          index.eq("stripeInvoiceId", args.paymentFailureInvoiceId!),
        )
        .unique();
      if (!invoiceFailure) {
        await ctx.db.insert("stripeInvoicePaymentFailures", {
          firstFailedAt: args.paymentFailedAt!,
          lastFailureEventCreated: args.eventCreated,
          stripeInvoiceId: args.paymentFailureInvoiceId!,
          stripeSubscriptionId: args.stripeSubscriptionId,
          updatedAt: Date.now(),
        });
      } else if (
        invoiceFailure.stripeSubscriptionId === args.stripeSubscriptionId
      ) {
        await ctx.db.patch(invoiceFailure._id, {
          firstFailedAt: Math.min(
            invoiceFailure.firstFailedAt,
            args.paymentFailedAt!,
          ),
          lastFailureEventCreated: Math.max(
            invoiceFailure.lastFailureEventCreated,
            args.eventCreated,
          ),
          updatedAt: Date.now(),
        });
      }
    }
    const request = {
      generation,
      latestEventCreated: Math.max(
        existing?.latestEventCreated ?? 0,
        args.eventCreated,
      ),
      latestEventId:
        !existing || args.eventCreated >= existing.latestEventCreated
          ? args.eventId
          : existing.latestEventId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.replace(existing._id, request);
    else await ctx.db.insert("stripeSubscriptionReconciliations", request);
    await ctx.db.insert("stripeWebhookEvents", {
      eventType: args.eventType,
      outcome: "queued",
      processedAt: Date.now(),
      stripeEventCreated: args.eventCreated,
      stripeEventId: args.eventId,
      stripeSubscriptionId: args.stripeSubscriptionId,
    });
    await ctx.scheduler.runAfter(
      2_000,
      internal.stripeWebhookSync.dispatchReconciliation,
      {
        attempt: 0,
        generation,
        stripeSubscriptionId: args.stripeSubscriptionId,
      },
    );
    return { generation, outcome: "queued" as const };
  },
});

export const dispatchReconciliation = internalMutation({
  args: {
    attempt: v.number(),
    generation: v.number(),
    stripeSubscriptionId: v.string(),
  },
  returns: v.object({ dispatched: v.boolean() }),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("stripeSubscriptionReconciliations")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (
      !request ||
      request.generation !== args.generation ||
      request.completedGeneration === args.generation
    ) {
      return { dispatched: false };
    }
    await ctx.db.patch(request._id, {
      lastAttemptAt: Date.now(),
      lastError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.stripeWebhookReconciliation.reconcileSubscription,
      {
        attempt: args.attempt,
        generation: args.generation,
        stripeSubscriptionId: args.stripeSubscriptionId,
      },
    );
    await ctx.scheduler.runAfter(
      Math.min(
        2 ** Math.min(args.attempt, 12) * 120_000,
        maximumReconciliationRetryMs,
      ),
      internal.stripeWebhookSync.dispatchReconciliation,
      {
        attempt: args.attempt + 1,
        generation: args.generation,
        stripeSubscriptionId: args.stripeSubscriptionId,
      },
    );
    return { dispatched: true };
  },
});

export const recordReconciliationFailure = internalMutation({
  args: {
    error: v.string(),
    generation: v.number(),
    stripeSubscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("stripeSubscriptionReconciliations")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (
      request?.generation === args.generation &&
      request.completedGeneration !== args.generation
    ) {
      await ctx.db.patch(request._id, {
        lastError: args.error,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const applySubscriptionEvent = internalMutation({
  args: {
    cancelAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(),
    eventCreated: v.number(),
    eventId: v.string(),
    eventType: v.string(),
    organizationId: v.optional(v.string()),
    priceId: v.string(),
    providerGeneration: v.optional(v.number()),
    providerObservedAt: v.optional(v.number()),
    requiredReconciliationGeneration: v.optional(v.number()),
    status: v.string(),
    statusChangedAt: v.optional(v.number()),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
  },
  returns: v.object({ outcome: outcomeValidator }),
  handler: async (ctx, args) => {
    if (
      await subscriptionDeletionStarted(
        ctx,
        args.stripeSubscriptionId,
        args.organizationId,
      )
    ) {
      return { outcome: "ignored" as const };
    }
    const priorEvent = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_stripe_event", (index) =>
        index.eq("stripeEventId", args.eventId),
      )
      .unique();
    if (priorEvent) return { outcome: "duplicate" as const };

    let reconciliationRequest: Doc<"stripeSubscriptionReconciliations"> | null =
      null;
    if (args.requiredReconciliationGeneration !== undefined) {
      reconciliationRequest = await ctx.db
        .query("stripeSubscriptionReconciliations")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
        )
        .unique();
      if (
        reconciliationRequest?.generation !==
        args.requiredReconciliationGeneration
      ) {
        return { outcome: "stale" as const };
      }
    }

    const existing = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    const suppliedOrganizationId = args.organizationId
      ? ctx.db.normalizeId("organizations", args.organizationId)
      : null;
    const organizationId = existing?.organizationId ?? suppliedOrganizationId;
    const conflictsWithExistingOrganization = Boolean(
      existing &&
      suppliedOrganizationId &&
      existing.organizationId !== suppliedOrganizationId,
    );
    const providerObservedAt =
      args.providerObservedAt ?? args.eventCreated * 1_000;
    const existingProviderObservedAt = existing
      ? (existing.lastProviderObservedAt ??
        existing.lastStripeEventCreated * 1_000)
      : null;
    const stale = Boolean(
      existing &&
      (args.providerGeneration !== undefined
        ? args.providerGeneration < (existing.lastProviderGeneration ?? 0)
        : existingProviderObservedAt !== null &&
          (providerObservedAt < existingProviderObservedAt ||
            (providerObservedAt === existingProviderObservedAt &&
              args.status !== existing.status &&
              statusRestriction(args.status) <=
                statusRestriction(existing.status)))),
    );
    const outcome =
      !organizationId || conflictsWithExistingOrganization
        ? ("ignored" as const)
        : stale
          ? ("stale" as const)
          : ("applied" as const);

    let snapshotForDeadline:
      | {
          currentPeriodEnd: number;
          status: string;
          statusChangedAt?: number;
          stripeSubscriptionId: string;
        }
      | undefined;
    if (outcome === "applied" && organizationId) {
      const statusChangedAt =
        existing?.status === args.status
          ? (args.statusChangedAt ?? existing.statusChangedAt)
          : args.statusChangedAt;
      const snapshot = {
        cancelAt: args.cancelAt,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodEnd: args.currentPeriodEnd,
        lastStripeEventCreated: args.eventCreated,
        lastStripeEventId: args.eventId,
        lastProviderGeneration:
          args.providerGeneration ?? existing?.lastProviderGeneration,
        lastProviderObservedAt: providerObservedAt,
        organizationId,
        priceId: args.priceId,
        status: args.status,
        statusChangedAt,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        updatedAt: Date.now(),
      };
      if (existing) await ctx.db.replace(existing._id, snapshot);
      else await ctx.db.insert("billingSubscriptionStates", snapshot);
      await syncBillingDowngradeLifecycle(ctx, snapshot);
      snapshotForDeadline = snapshot;
    } else if (
      outcome === "stale" &&
      existing?.status === args.status &&
      existing.statusChangedAt === undefined &&
      args.statusChangedAt !== undefined
    ) {
      await ctx.db.patch(existing._id, {
        statusChangedAt: args.statusChangedAt,
        updatedAt: Date.now(),
      });
      const completedSnapshot = {
        ...existing,
        statusChangedAt: args.statusChangedAt,
      };
      await syncBillingDowngradeLifecycle(ctx, completedSnapshot);
      snapshotForDeadline = completedSnapshot;
    }

    await ctx.db.insert("stripeWebhookEvents", {
      eventType: args.eventType,
      outcome,
      processedAt: Date.now(),
      stripeEventCreated: args.eventCreated,
      stripeEventId: args.eventId,
      stripeSubscriptionId: args.stripeSubscriptionId,
    });
    const deadline = snapshotForDeadline
      ? entitlementDeadline(snapshotForDeadline)
      : null;
    if (deadline !== null) {
      await scheduleEntitlementDeadline(
        ctx,
        args.stripeSubscriptionId,
        deadline,
      );
    }
    if (outcome === "applied" && reconciliationRequest) {
      await ctx.db.patch(reconciliationRequest._id, {
        completedGeneration: reconciliationRequest.generation,
        lastAttemptAt: Date.now(),
        lastError: undefined,
        updatedAt: Date.now(),
      });
    }
    return { outcome };
  },
});
