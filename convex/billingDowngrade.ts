import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authzForOrganization } from "./authorization";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { requireOrganizationPermission } from "./security/organizationAccess";

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_SCHEDULE_HOP_MS = 20 * DAY_MS;
const VIDEO_RETENTION_MS = 30 * DAY_MS;
const FREE_TEXT_LIMIT = 13;
const FREE_VIDEO_LIMIT = 2;
const terminalStatuses = new Set([
  "canceled",
  "incomplete_expired",
  "paused",
  "unpaid",
]);

function transitionTarget(snapshot: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number;
  status: string;
  statusChangedAt?: number;
}) {
  if (
    snapshot.status === "past_due" &&
    snapshot.statusChangedAt !== undefined
  ) {
    return {
      scheduledFor: snapshot.statusChangedAt * 1_000 + 7 * DAY_MS,
      trigger: "payment_grace" as const,
    };
  }
  if (
    snapshot.status === "active" &&
    snapshot.cancelAtPeriodEnd &&
    snapshot.currentPeriodEnd > 0
  ) {
    return {
      scheduledFor: snapshot.currentPeriodEnd * 1_000,
      trigger: "scheduled_cancellation" as const,
    };
  }
  if (terminalStatuses.has(snapshot.status)) {
    return {
      scheduledFor: Date.now(),
      trigger: "terminal_status" as const,
    };
  }
  return null;
}

async function authoritativeTransition(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  const stripeSubscriptionId = entitlement.subscription?.stripeSubscriptionId;
  if (!stripeSubscriptionId) return { entitlement, transition: null };
  const transition = await ctx.db
    .query("billingDowngradeTransitions")
    .withIndex("by_stripe_subscription", (index) =>
      index.eq("stripeSubscriptionId", stripeSubscriptionId),
    )
    .unique();
  return {
    entitlement,
    transition:
      transition?.organizationId === organizationId ? transition : null,
  };
}

async function scheduleTransitionTick(
  ctx: MutationCtx,
  transitionId: Id<"billingDowngradeTransitions">,
  version: number,
  at: number,
) {
  await ctx.scheduler.runAt(
    Math.max(Date.now(), Math.min(at, Date.now() + MAXIMUM_SCHEDULE_HOP_MS)),
    internal.billingDowngrade.processTransition,
    { transitionId, version },
  );
}

export async function syncBillingDowngradeLifecycle(
  ctx: MutationCtx,
  snapshot: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number;
    organizationId: Id<"organizations">;
    status: string;
    statusChangedAt?: number;
    stripeSubscriptionId: string;
  },
) {
  const existing = await ctx.db
    .query("billingDowngradeTransitions")
    .withIndex("by_stripe_subscription", (index) =>
      index.eq("stripeSubscriptionId", snapshot.stripeSubscriptionId),
    )
    .unique();
  const target = transitionTarget(snapshot);
  const now = Date.now();
  if (existing?.status === "applied") {
    if (target) return;
    await ctx.db.patch(existing._id, {
      status: "recovered",
      updatedAt: now,
      version: existing.version + 1,
    });
    return;
  }
  if (!target) {
    if (existing?.status === "scheduled" || existing?.status === "processing") {
      await ctx.db.patch(existing._id, {
        status: "recovered",
        updatedAt: now,
        version: existing.version + 1,
      });
    }
    return;
  }
  if (
    (existing?.status === "scheduled" || existing?.status === "processing") &&
    existing.trigger === target.trigger &&
    (target.trigger === "terminal_status" ||
      existing.scheduledFor === target.scheduledFor)
  ) {
    return;
  }

  const version = (existing?.version ?? 0) + 1;
  const transition = {
    appliedAt: undefined,
    createdAt: existing?.createdAt ?? now,
    organizationId: snapshot.organizationId,
    scheduledFor: target.scheduledFor,
    selectedTextIds: existing?.selectedTextIds ?? [],
    selectedVideoIds: existing?.selectedVideoIds ?? [],
    status: "scheduled" as const,
    stripeSubscriptionId: snapshot.stripeSubscriptionId,
    trigger: target.trigger,
    updatedAt: now,
    version,
  };
  const transitionId = existing
    ? (await ctx.db.replace(existing._id, transition), existing._id)
    : await ctx.db.insert("billingDowngradeTransitions", transition);
  await scheduleTransitionTick(
    ctx,
    transitionId,
    version,
    Math.min(
      target.scheduledFor,
      Math.max(now, target.scheduledFor - 7 * DAY_MS),
    ),
  );
}

async function resolvedKeepers(
  ctx: MutationCtx,
  transition: Doc<"billingDowngradeTransitions">,
  type: "text" | "video",
  limit: number,
) {
  const selectedIds =
    type === "text"
      ? transition.selectedTextIds.slice(0, limit)
      : transition.selectedVideoIds.slice(0, limit);
  const selectedProjections = (
    await Promise.all(
      selectedIds.map((testimonialId) =>
        ctx.db
          .query("publicTestimonialProjections")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .unique(),
      ),
    )
  ).filter(
    (projection): projection is Doc<"publicTestimonialProjections"> =>
      projection?.organizationId === transition.organizationId &&
      projection.type === type,
  );
  const recent = await ctx.db
    .query("publicTestimonialProjections")
    .withIndex("by_organization_type_published_at", (index) =>
      index.eq("organizationId", transition.organizationId).eq("type", type),
    )
    .order("desc")
    .take(limit + selectedIds.length);
  return [
    ...pickKeepers(
      [...selectedProjections, ...recent],
      selectedProjections.map((item) => item.testimonialId),
      limit,
    ),
  ];
}

function pickKeepers(
  projections: Doc<"publicTestimonialProjections">[],
  selectedIds: Id<"testimonials">[],
  limit: number,
) {
  const eligible = new Map(
    projections.map((projection) => [projection.testimonialId, projection]),
  );
  const selected = selectedIds.filter((id) => eligible.has(id)).slice(0, limit);
  const selectedSet = new Set(selected);
  const ordered = [...projections].sort(
    (left, right) =>
      right.publishedAt - left.publishedAt ||
      String(right.testimonialId).localeCompare(String(left.testimonialId)),
  );
  const fallback: Id<"testimonials">[] = [];
  for (const projection of ordered) {
    if (!selectedSet.has(projection.testimonialId)) {
      fallback.push(projection.testimonialId);
    }
  }
  return new Set([...selected, ...fallback].slice(0, limit));
}

function isTransitionDue(
  transition: Doc<"billingDowngradeTransitions">,
  subscription: Doc<"billingSubscriptionStates"> | null,
  now: number,
) {
  if (
    !subscription ||
    subscription.organizationId !== transition.organizationId
  ) {
    return false;
  }
  if (transition.trigger === "payment_grace") {
    return subscription.status === "past_due" && now >= transition.scheduledFor;
  }
  if (transition.trigger === "scheduled_cancellation") {
    return (
      subscription.cancelAtPeriodEnd &&
      now >= transition.scheduledFor &&
      subscription.currentPeriodEnd * 1_000 <= now
    );
  }
  return terminalStatuses.has(subscription.status);
}

async function ensureLifecycleEmail(
  ctx: MutationCtx,
  transition: Doc<"billingDowngradeTransitions">,
  kind:
    | "downgrade_d7"
    | "downgrade_d1"
    | "video_retention_started"
    | "video_retention_d7"
    | "video_retention_d1",
  scheduledFor: number,
) {
  const deliveryKey = `${transition._id}:${transition.version}:${kind}`;
  const existing = await ctx.db
    .query("billingLifecycleEmails")
    .withIndex("by_delivery_key", (index) =>
      index.eq("deliveryKey", deliveryKey),
    )
    .unique();
  if (existing) return;
  const emailId = await ctx.db.insert("billingLifecycleEmails", {
    attempts: 0,
    createdAt: Date.now(),
    deliveryKey,
    kind,
    organizationId: transition.organizationId,
    scheduledFor,
    status: "pending",
    transitionId: transition._id,
    transitionVersion: transition.version,
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAt(
    Math.max(Date.now(), scheduledFor),
    internal.billingDowngradeEmail.deliverLifecycleEmail,
    { emailId },
  );
}

export const processTransition = internalMutation({
  args: {
    transitionId: v.id("billingDowngradeTransitions"),
    version: v.number(),
  },
  returns: v.object({ outcome: v.string() }),
  handler: async (ctx, args) => {
    const transition = await ctx.db.get(args.transitionId);
    if (
      !transition ||
      transition.version !== args.version ||
      transition.status !== "scheduled"
    ) {
      return { outcome: "stale" };
    }
    const now = Date.now();
    const authoritative = await authoritativeTransition(
      ctx,
      transition.organizationId,
    );
    if (authoritative.transition?._id !== transition._id) {
      await ctx.db.patch(transition._id, {
        status: "recovered",
        updatedAt: now,
        version: transition.version + 1,
      });
      return { outcome: "recovered" };
    }
    const d7 = transition.scheduledFor - 7 * DAY_MS;
    const d1 = transition.scheduledFor - DAY_MS;
    if (now >= d7 && now < d1) {
      await ensureLifecycleEmail(ctx, transition, "downgrade_d7", d7);
    }
    if (now >= d1 && now < transition.scheduledFor) {
      await ensureLifecycleEmail(ctx, transition, "downgrade_d1", d1);
    }
    if (now < transition.scheduledFor) {
      const nextAt = [d7, d1, transition.scheduledFor].find(
        (candidate) => candidate > now,
      );
      await scheduleTransitionTick(
        ctx,
        transition._id,
        transition.version,
        nextAt ?? transition.scheduledFor,
      );
      return { outcome: "scheduled" };
    }

    const subscription = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_stripe_subscription", (index) =>
        index.eq("stripeSubscriptionId", transition.stripeSubscriptionId),
      )
      .unique();
    if (!isTransitionDue(transition, subscription, now)) {
      await ctx.db.patch(transition._id, {
        status: "recovered",
        updatedAt: now,
        version: transition.version + 1,
      });
      return { outcome: "recovered" };
    }
    const [resolvedTextIds, resolvedVideoIds] = await Promise.all([
      resolvedKeepers(ctx, transition, "text", FREE_TEXT_LIMIT),
      resolvedKeepers(ctx, transition, "video", FREE_VIDEO_LIMIT),
    ]);
    await ctx.db.patch(transition._id, {
      processingCursor: undefined,
      resolvedTextIds,
      resolvedVideoIds,
      status: "processing",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.billingDowngrade.processTransitionBatch,
      {
        cursor: null,
        transitionId: transition._id,
        version: transition.version,
      },
    );
    return { outcome: "processing" };
  },
});

export const processTransitionBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    transitionId: v.id("billingDowngradeTransitions"),
    version: v.number(),
  },
  returns: v.object({ outcome: v.string() }),
  handler: async (ctx, args) => {
    const transition = await ctx.db.get(args.transitionId);
    if (
      !transition ||
      transition.version !== args.version ||
      transition.status !== "processing" ||
      (transition.processingCursor ?? null) !== args.cursor ||
      !transition.resolvedTextIds ||
      !transition.resolvedVideoIds
    ) {
      return { outcome: "stale" };
    }
    const now = Date.now();
    const authoritative = await authoritativeTransition(
      ctx,
      transition.organizationId,
    );
    if (
      authoritative.transition?._id !== transition._id ||
      authoritative.entitlement.effectivePlan === "premium"
    ) {
      await ctx.db.patch(transition._id, {
        processingCursor: undefined,
        status: "recovered",
        updatedAt: now,
        version: transition.version + 1,
      });
      return { outcome: "recovered" };
    }
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_published_at", (index) =>
        index.eq("organizationId", transition.organizationId),
      )
      .paginate({ cursor: args.cursor, numItems: 50 });
    const textKeepers = new Set(transition.resolvedTextIds);
    const videoKeepers = new Set(transition.resolvedVideoIds);
    const excess = page.page.filter((projection) =>
      projection.type === "text"
        ? !textKeepers.has(projection.testimonialId)
        : !videoKeepers.has(projection.testimonialId),
    );
    await Promise.all(
      excess.map(async (projection) => {
        const testimonial = await ctx.db.get(projection.testimonialId);
        if (
          !testimonial ||
          testimonial.organizationId !== transition.organizationId
        ) {
          return;
        }
        await ctx.db.delete(projection._id);
        await ctx.db.patch(testimonial._id, {
          moderationStatus: "archived",
          updatedAt: now,
        });
        if (projection.type !== "video") return;
        const asset = await ctx.db
          .query("videoAssets")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique();
        if (!asset) return;
        const priorRetention = await ctx.db
          .query("videoDowngradeRetentions")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique();
        if (priorRetention?.status === "retained") return;
        const retention = {
          attempts: 0,
          createdAt: now,
          expiresAt: now + VIDEO_RETENTION_MS,
          organizationId: transition.organizationId,
          retainedAt: now,
          status: "retained" as const,
          testimonialId: testimonial._id,
          transitionId: transition._id,
          updatedAt: now,
          videoAssetId: asset._id,
        };
        const retentionId = priorRetention
          ? (await ctx.db.replace(priorRetention._id, retention),
            priorRetention._id)
          : await ctx.db.insert("videoDowngradeRetentions", retention);
        await ctx.scheduler.runAt(
          now + VIDEO_RETENTION_MS,
          internal.billingDowngradeVideo.deleteRetainedVideo,
          { retentionId },
        );
      }),
    );
    if (!page.isDone) {
      await ctx.db.patch(transition._id, {
        processingCursor: page.continueCursor,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        0,
        internal.billingDowngrade.processTransitionBatch,
        {
          cursor: page.continueCursor,
          transitionId: transition._id,
          version: transition.version,
        },
      );
      return { outcome: "processing" };
    }
    const retentions = await ctx.db
      .query("videoDowngradeRetentions")
      .withIndex("by_transition", (index) =>
        index.eq("transitionId", transition._id),
      )
      .take(1);
    await ctx.db.patch(transition._id, {
      appliedAt: Date.now(),
      processingCursor: undefined,
      status: "applied",
      updatedAt: Date.now(),
    });
    if (retentions.length > 0) {
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_started",
        Date.now(),
      );
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_d7",
        Date.now() + 23 * DAY_MS,
      );
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_d1",
        Date.now() + 29 * DAY_MS,
      );
    }
    return { outcome: "applied" };
  },
});

export const getPlan = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    const { transition } = await authoritativeTransition(
      ctx,
      access.organization._id,
    );
    if (transition?.status !== "scheduled") return null;
    return {
      canManage: await authzForOrganization(access.tenantId).can(
        ctx,
        access.principal.actorId,
        "billing:manage",
      ),
      scheduledFor: transition.scheduledFor,
      selectedTextIds: transition.selectedTextIds,
      selectedVideoIds: transition.selectedVideoIds,
      textLimit: FREE_TEXT_LIMIT,
      trigger: transition.trigger,
      videoLimit: FREE_VIDEO_LIMIT,
    };
  },
});

export const listCandidates = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_published_at", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const candidates = await Promise.all(
      page.page.map(async (projection) => {
        const testimonial = await ctx.db.get(projection.testimonialId);
        return testimonial
          ? {
              id: testimonial._id,
              name: testimonial.submitterName,
              publishedAt: projection.publishedAt,
              type: projection.type,
            }
          : null;
      }),
    );
    return { ...page, page: candidates.filter((item) => item !== null) };
  },
});

export const updateSelection = mutation({
  args: {
    organizationId: v.id("organizations"),
    textIds: v.array(v.id("testimonials")),
    videoIds: v.array(v.id("testimonials")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    if (
      new Set(args.textIds).size !== args.textIds.length ||
      new Set(args.videoIds).size !== args.videoIds.length ||
      new Set([...args.textIds, ...args.videoIds]).size !==
        args.textIds.length + args.videoIds.length ||
      args.textIds.length > FREE_TEXT_LIMIT ||
      args.videoIds.length > FREE_VIDEO_LIMIT
    ) {
      throw new ConvexError({
        code: "INVALID_DOWNGRADE_SELECTION",
        message: "Choose at most 13 text and 2 video Testimonials.",
      });
    }
    const { transition } = await authoritativeTransition(
      ctx,
      access.organization._id,
    );
    if (transition?.status !== "scheduled") {
      throw new ConvexError({
        code: "DOWNGRADE_NOT_SCHEDULED",
        message: "No downgrade selection is currently required.",
      });
    }
    const selected = [...args.textIds, ...args.videoIds];
    const textIds = new Set(args.textIds);
    for (const testimonialId of selected) {
      const [testimonial, projection] = await Promise.all([
        ctx.db.get(testimonialId),
        ctx.db
          .query("publicTestimonialProjections")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .unique(),
      ]);
      const expectedType = textIds.has(testimonialId) ? "text" : "video";
      if (
        !testimonial ||
        testimonial.organizationId !== access.organization._id ||
        testimonial.submissionType !== expectedType ||
        projection?.organizationId !== access.organization._id
      ) {
        throw new ConvexError({
          code: "INVALID_DOWNGRADE_SELECTION",
          message: "Only currently Published Testimonials can be kept.",
        });
      }
    }
    await ctx.db.patch(transition._id, {
      selectedTextIds: args.textIds,
      selectedVideoIds: args.videoIds,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const cancelVideoRetentionForReactivation = async (
  ctx: MutationCtx,
  testimonialId: Id<"testimonials">,
) => {
  const retention = await ctx.db
    .query("videoDowngradeRetentions")
    .withIndex("by_testimonial", (index) =>
      index.eq("testimonialId", testimonialId),
    )
    .unique();
  if (retention?.status === "retained") await ctx.db.delete(retention._id);
};
