import { projectionIsPublic, removePublicProjection } from "./publicProjection";
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
import {
  getAccountBillingEntitlement,
  getOrganizationBillingEntitlement,
} from "./billingEntitlements";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { resolveFreeProject } from "./projectActivity";

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
  accountId?: Id<"accounts">,
) {
  accountId ??= (await ctx.db.get(organizationId))?.accountId;
  const entitlement = accountId
    ? await getAccountBillingEntitlement(ctx, accountId)
    : await getOrganizationBillingEntitlement(ctx, organizationId);
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
      transition?.organizationId === organizationId ||
      (accountId && transition?.accountId === accountId)
        ? transition
        : null,
  };
}

async function downgradeProjectId(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"organizations">,
) {
  const account = project.accountId
    ? await ctx.db.get(project.accountId)
    : null;
  return account
    ? ((await resolveFreeProject(ctx, account))?._id ?? project._id)
    : project._id;
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

// Persist the revocation before a webhook can replace an expired entitlement.
// Scheduled workers may not have executed at the instant payment recovers.
export async function freezeExpiredAccountPublications(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  accountId: Id<"accounts">,
) {
  const { entitlement, transition } = await authoritativeTransition(
    ctx,
    organizationId,
    accountId,
  );
  if (
    entitlement.effectivePlan === "free" &&
    transition &&
    transition.status !== "recovered" &&
    transition.scheduledFor <= Date.now()
  ) {
    await freezeAccountPublications(ctx, transition);
  }
}

export async function syncBillingDowngradeLifecycle(
  ctx: MutationCtx,
  snapshot: {
    accountId?: Id<"accounts">;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number;
    organizationId: Id<"organizations">;
    status: string;
    statusChangedAt?: number;
    stripeSubscriptionId: string;
  },
) {
  const accountId =
    snapshot.accountId ??
    (await ctx.db.get(snapshot.organizationId))?.accountId;
  const recoveredToPro =
    (accountId
      ? await getAccountBillingEntitlement(ctx, accountId)
      : await getOrganizationBillingEntitlement(ctx, snapshot.organizationId)
    ).effectivePlan === "premium";
  if (accountId && recoveredToPro) {
    const recoveredAt = Date.now();
    await ctx.db.patch(accountId, { lastProRecoveryAt: recoveredAt });
    await ctx.scheduler.runAfter(
      0,
      internal.billingDowngrade.recoverAccountTransitions,
      {
        accountId,
        recoveredAt,
        currentSubscriptionId: snapshot.stripeSubscriptionId,
        cursor: null,
      },
    );
  }
  const existing = await ctx.db
    .query("billingDowngradeTransitions")
    .withIndex("by_stripe_subscription", (index) =>
      index.eq("stripeSubscriptionId", snapshot.stripeSubscriptionId),
    )
    .unique();
  const target = transitionTarget(snapshot);
  const now = Date.now();
  if (existing?.status === "applied") {
    if (target || !recoveredToPro) return;
    await ctx.db.patch(existing._id, {
      status: "recovered",
      updatedAt: now,
      version: existing.version + 1,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.billingDowngrade.cancelRecoveredRetentions,
      { transitionId: existing._id, version: existing.version + 1 },
    );
    return;
  }
  if (!target) {
    if (
      recoveredToPro &&
      (existing?.status === "scheduled" || existing?.status === "processing")
    ) {
      await ctx.db.patch(existing._id, {
        status: "recovered",
        updatedAt: now,
        version: existing.version + 1,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.billingDowngrade.cancelRecoveredRetentions,
        { transitionId: existing._id, version: existing.version + 1 },
      );
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
    accountId,
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
  if (accountId && target.scheduledFor <= now && !recoveredToPro) {
    await freezeAccountPublications(ctx, (await ctx.db.get(transitionId))!);
  }
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
  const account = transition.accountId
    ? await ctx.db.get(transition.accountId)
    : null;
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
      projection.type === type &&
      projectionIsPublic(account, projection),
  );
  const preserved = await Promise.all(
    (account?.preservedPublicationIds ?? []).map((testimonialId) =>
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", testimonialId),
        )
        .unique(),
    ),
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
      [
        ...selectedProjections,
        ...preserved.filter(
          (projection): projection is Doc<"publicTestimonialProjections"> =>
            projection?.organizationId === transition.organizationId &&
            projection.type === type &&
            projectionIsPublic(account, projection),
        ),
        ...recent.filter((projection) =>
          projectionIsPublic(account, projection),
        ),
      ],
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
  const ordered = [...eligible.values()].sort(
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
      transition.accountId,
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
    const account = transition.accountId
      ? await ctx.db.get(transition.accountId)
      : null;
    const activeProject = account
      ? await resolveFreeProject(ctx, account)
      : null;
    const keeperTransition = activeProject
      ? { ...transition, organizationId: activeProject._id }
      : transition;
    const [resolvedTextIds, resolvedVideoIds] = await Promise.all([
      resolvedKeepers(ctx, keeperTransition, "text", FREE_TEXT_LIMIT),
      resolvedKeepers(ctx, keeperTransition, "video", FREE_VIDEO_LIMIT),
    ]);
    await freezeAccountPublications(ctx, transition);
    const firstProjects = transition.accountId
      ? await ctx.db
          .query("organizations")
          .withIndex("by_account_open", (q) =>
            q
              .eq("accountId", transition.accountId)
              .eq("deletionStartedAt", undefined),
          )
          .paginate({ cursor: null, numItems: 1 })
      : null;
    await ctx.db.patch(transition._id, {
      processingProjectId: firstProjects?.page[0]?._id,
      projectCursor: firstProjects?.continueCursor,
      projectsExhausted: firstProjects?.isDone,
      activeProjectId: activeProject?._id,
      processingCursor: undefined,
      processingAssets: undefined,
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
      transition.accountId,
    );
    if (
      authoritative.transition?._id !== transition._id ||
      authoritative.entitlement.effectivePlan === "premium"
    ) {
      await ctx.db.patch(transition._id, {
        processingCursor: undefined,
        processingAssets: undefined,
        status: "recovered",
        updatedAt: now,
        version: transition.version + 1,
      });
      return { outcome: "recovered" };
    }
    if (transition.accountId)
      return processAccountTransitionBatch(ctx, transition);
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
        await removePublicProjection(ctx, projection);
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
      processingAssets: undefined,
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

async function processAccountTransitionBatch(
  ctx: MutationCtx,
  transition: Doc<"billingDowngradeTransitions">,
) {
  let projectId = transition.processingProjectId;
  let processingAssets = transition.processingAssets ?? false;
  let projectCursor = transition.projectCursor;
  let projectsExhausted = transition.projectsExhausted ?? false;
  if (!projectId && !projectsExhausted) {
    const projects = await ctx.db
      .query("organizations")
      .withIndex("by_account_open", (q) =>
        q
          .eq("accountId", transition.accountId)
          .eq("deletionStartedAt", undefined),
      )
      .paginate({ cursor: projectCursor ?? null, numItems: 1 });
    projectId = projects.page[0]?._id;
    projectCursor = projects.continueCursor;
    projectsExhausted = projects.isDone;
    await ctx.db.patch(transition._id, {
      processingProjectId: projectId,
      projectCursor,
      projectsExhausted,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.billingDowngrade.processTransitionBatch,
      {
        transitionId: transition._id,
        version: transition.version,
        cursor: null,
      },
    );
    return { outcome: "processing" };
  }
  const now = Date.now();
  let nextCursor: string | undefined;
  if (projectId && processingAssets) {
    const page = await ctx.db
      .query("videoAssets")
      .withIndex("by_organization", (q) => q.eq("organizationId", projectId!))
      .paginate({ cursor: transition.processingCursor ?? null, numItems: 50 });
    for (const asset of page.page) await retainAccountVideo(ctx, asset);
    if (page.isDone) {
      projectId = undefined;
      processingAssets = false;
    } else nextCursor = page.continueCursor;
  } else if (projectId) {
    const page = await ctx.db
      .query("testimonials")
      .withIndex("by_organization", (q) => q.eq("organizationId", projectId!))
      .paginate({ cursor: transition.processingCursor ?? null, numItems: 50 });
    const keepers = new Set([
      ...(transition.resolvedTextIds ?? []),
      ...(transition.resolvedVideoIds ?? []),
    ]);
    for (const testimonial of page.page) {
      if (
        projectId === transition.activeProjectId &&
        keepers.has(testimonial._id)
      )
        continue;
      const projection = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", testimonial._id),
        )
        .unique();
      if (projection) await removePublicProjection(ctx, projection);
      if (testimonial.moderationStatus === "published") {
        await ctx.db.patch(testimonial._id, {
          moderationStatus: "archived",
          updatedAt: now,
        });
      }
    }
    if (page.isDone) processingAssets = true;
    else nextCursor = page.continueCursor;
  }
  if (!projectId && projectsExhausted) {
    await ctx.db.patch(transition._id, {
      status: "applied",
      appliedAt: now,
      updatedAt: now,
      processingCursor: undefined,
      processingAssets: undefined,
      processingProjectId: undefined,
      projectCursor,
      projectsExhausted,
    });
    const retention = await ctx.db
      .query("videoDowngradeRetentions")
      .withIndex("by_transition", (q) => q.eq("transitionId", transition._id))
      .first();
    if (retention) {
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_started",
        now,
      );
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_d7",
        now + 23 * DAY_MS,
      );
      await ensureLifecycleEmail(
        ctx,
        transition,
        "video_retention_d1",
        now + 29 * DAY_MS,
      );
    }
    return { outcome: "applied" };
  }
  await ctx.db.patch(transition._id, {
    processingCursor: nextCursor,
    processingProjectId: projectId,
    processingAssets,
    projectCursor,
    projectsExhausted,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.billingDowngrade.processTransitionBatch,
    {
      transitionId: transition._id,
      version: transition.version,
      cursor: nextCursor ?? null,
    },
  );
  return { outcome: "processing" };
}

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
    const selectedProjectId = await downgradeProjectId(
      ctx,
      access.organization,
    );
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_published_at", (index) =>
        index.eq("organizationId", selectedProjectId),
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
    const selectedProjectId = await downgradeProjectId(
      ctx,
      access.organization,
    );
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
        testimonial.organizationId !== selectedProjectId ||
        testimonial.submissionType !== expectedType ||
        projection?.organizationId !== selectedProjectId
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

export const cancelRecoveredRetentions = internalMutation({
  args: {
    transitionId: v.id("billingDowngradeTransitions"),
    version: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const transition = await ctx.db.get(args.transitionId);
    if (
      !transition ||
      transition.status !== "recovered" ||
      transition.version !== args.version
    )
      return null;
    const rows = await ctx.db
      .query("videoDowngradeRetentions")
      .withIndex("by_transition_status_expiry", (q) =>
        q
          .eq("transitionId", transition._id)
          .eq("status", "retained")
          .gt("expiresAt", transition.updatedAt),
      )
      .take(50);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.billingDowngrade.cancelRecoveredRetentions,
        args,
      );
    return null;
  },
});

export const recoverAccountTransitions = internalMutation({
  args: {
    accountId: v.id("accounts"),
    recoveredAt: v.number(),
    currentSubscriptionId: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account || account.deletionStartedAt !== undefined) return null;
    const page = await ctx.db
      .query("billingDowngradeTransitions")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .paginate({ cursor: args.cursor, numItems: 32 });
    for (const transition of page.page) {
      if (
        transition.status === "recovered" ||
        transition.scheduledFor > args.recoveredAt ||
        transition.stripeSubscriptionId === args.currentSubscriptionId
      )
        continue;
      const version = transition.version + 1;
      await ctx.db.patch(transition._id, {
        status: "recovered",
        updatedAt: args.recoveredAt,
        version,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.billingDowngrade.cancelRecoveredRetentions,
        { transitionId: transition._id, version },
      );
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.billingDowngrade.recoverAccountTransitions,
        { ...args, cursor: page.continueCursor },
      );
    return null;
  },
});

async function freezeAccountPublications(
  ctx: MutationCtx,
  transition: Doc<"billingDowngradeTransitions">,
) {
  if (!transition.accountId) return;
  const account = await ctx.db.get(transition.accountId);
  const key = `${transition._id}:${transition.version}`;
  if (
    !account ||
    account.deletionStartedAt !== undefined ||
    account.publicationTransitionKey === key
  )
    return;
  const project = await resolveFreeProject(ctx, account);
  const scoped = project
    ? { ...transition, organizationId: project._id }
    : transition;
  const [texts, videos] = project
    ? await Promise.all([
        resolvedKeepers(ctx, scoped, "text", FREE_TEXT_LIMIT),
        resolvedKeepers(ctx, scoped, "video", FREE_VIDEO_LIMIT),
      ])
    : [[], []];
  await ctx.db.patch(account._id, {
    publicationGeneration: (account.publicationGeneration ?? 0) + 1,
    publicationTransitionKey: key,
    preservedPublicationIds: [...texts, ...videos],
  });
}

// Asset-level retention also covers uploads and replacements awaiting a testimonial.
export async function retainAccountVideo(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
) {
  const project = await ctx.db.get(asset.organizationId);
  if (!project?.accountId) return;
  const { entitlement, transition } = await authoritativeTransition(
    ctx,
    project._id,
    project.accountId,
  );
  if (
    entitlement.effectivePlan !== "free" ||
    !transition ||
    transition.status === "recovered" ||
    transition.scheduledFor > Date.now()
  )
    return;
  const reservation = await ctx.db.get(asset.reservationId);
  if (
    reservation?.plan === "free" &&
    reservation.createdAt >= transition.scheduledFor
  )
    return;
  await freezeAccountPublications(ctx, transition);
  const account = await ctx.db.get(project.accountId);
  const prior = await ctx.db
    .query("videoDowngradeRetentions")
    .withIndex("by_video_asset", (q) => q.eq("videoAssetId", asset._id))
    .unique();
  if (
    asset.testimonialId &&
    account?.preservedPublicationIds?.includes(asset.testimonialId)
  ) {
    if (prior?.status === "retained") await ctx.db.delete(prior._id);
    return;
  }
  if (prior?.status === "deleting") return;
  if (asset.testimonialId) {
    const previous = await ctx.db
      .query("videoDowngradeRetentions")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", asset.testimonialId),
      )
      .take(2);
    for (const record of previous)
      if (record.videoAssetId !== asset._id)
        await ctx.db.patch(record._id, { testimonialId: undefined });
  }
  if (prior?.status === "retained" && prior.transitionId === transition._id) {
    if (prior.testimonialId !== asset.testimonialId)
      await ctx.db.patch(prior._id, { testimonialId: asset.testimonialId });
    return;
  }
  const now = Date.now();
  const expiresAt = transition.scheduledFor + VIDEO_RETENTION_MS;
  const value = {
    organizationId: project._id,
    transitionId: transition._id,
    testimonialId: asset.testimonialId,
    videoAssetId: asset._id,
    retainedAt: now,
    expiresAt,
    status: "retained" as const,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const retentionId = prior
    ? (await ctx.db.replace(prior._id, value), prior._id)
    : await ctx.db.insert("videoDowngradeRetentions", value);
  await ctx.scheduler.runAt(
    Math.max(now, expiresAt),
    internal.billingDowngradeVideo.deleteRetainedVideo,
    { retentionId },
  );
  await ensureLifecycleEmail(ctx, transition, "video_retention_started", now);
  await ensureLifecycleEmail(
    ctx,
    transition,
    "video_retention_d7",
    expiresAt - 7 * DAY_MS,
  );
  await ensureLifecycleEmail(
    ctx,
    transition,
    "video_retention_d1",
    expiresAt - DAY_MS,
  );
}
