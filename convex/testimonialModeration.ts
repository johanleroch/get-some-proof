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
import { recordOrganizationAuditEvent } from "./auditEvents";
import { cancelVideoRetentionForReactivation } from "./billingDowngrade";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { nextPublicOrderKey, upsertPublicProjection } from "./publicProjection";
import { requireOrganizationPermission } from "./security/organizationAccess";

const inboxStatusValidator = v.union(
  v.literal("pending"),
  v.literal("published"),
  v.literal("archived"),
  v.literal("spam"),
);
type InboxStatus = "pending" | "published" | "archived" | "spam";

const inboxIdentityValidator = {
  avatarUrl: v.union(v.null(), v.string()),
  company: v.optional(v.string()),
  consentAcceptedAt: v.number(),
  createdAt: v.number(),
  moderationStatus: inboxStatusValidator,
  quarantineExpiresAt: v.optional(v.number()),
  spamCreditRestored: v.optional(v.boolean()),
  rating: v.optional(v.number()),
  role: v.optional(v.string()),
  submitterEmail: v.string(),
  submitterName: v.string(),
  testimonialId: v.id("testimonials"),
  publicVisibilityOverrides: v.optional(
    v.object({
      avatar: v.optional(v.boolean()),
      company: v.optional(v.boolean()),
      rating: v.optional(v.boolean()),
      role: v.optional(v.boolean()),
    }),
  ),
};

const inboxItemValidator = v.union(
  v.object({
    ...inboxIdentityValidator,
    submissionType: v.literal("text"),
    text: v.string(),
  }),
  v.object({
    ...inboxIdentityValidator,
    captionsStatus: v.union(
      v.literal("requested"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    durationSeconds: v.optional(v.number()),
    playbackId: v.optional(v.string()),
    submissionType: v.literal("video"),
    videoStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
  }),
);

function testimonialUnavailable(): never {
  throw new ConvexError({
    code: "TESTIMONIAL_UNAVAILABLE",
    message: "Testimonial unavailable.",
  });
}

async function findTestimonial(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  testimonialId: Id<"testimonials">,
) {
  const testimonial = await ctx.db.get(testimonialId);
  if (!testimonial || testimonial.organizationId !== organizationId) {
    testimonialUnavailable();
  }
  return testimonial;
}

export const listInbox = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    sort: v.union(v.literal("newest"), v.literal("oldest")),
    status: v.optional(inboxStatusValidator),
    submissionType: v.optional(v.union(v.literal("text"), v.literal("video"))),
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    page: v.array(inboxItemValidator),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const indexedQuery = args.status
      ? ctx.db
          .query("testimonials")
          .withIndex("by_organization_status", (index) =>
            index
              .eq("organizationId", access.organization._id)
              .eq("moderationStatus", args.status!),
          )
      : ctx.db
          .query("testimonials")
          .withIndex("by_organization_created_at", (index) =>
            index.eq("organizationId", access.organization._id),
          );
    const visibleQuery = args.submissionType
      ? indexedQuery.filter((filter) =>
          filter.eq(filter.field("submissionType"), args.submissionType),
        )
      : indexedQuery;
    const page = await visibleQuery
      .order(args.sort === "newest" ? "desc" : "asc")
      .paginate(args.paginationOpts);

    const inboxItems = await Promise.all(
      page.page.map(async (testimonial) => {
        const [avatarUrl, consent, videoAsset, quarantine] = await Promise.all([
          testimonial.avatarStorageId
            ? ctx.storage.getUrl(testimonial.avatarStorageId)
            : null,
          ctx.db
            .query("publicationConsents")
            .withIndex("by_testimonial", (index) =>
              index.eq("testimonialId", testimonial._id),
            )
            .unique(),
          testimonial.submissionType === "video"
            ? ctx.db
                .query("videoAssets")
                .withIndex("by_testimonial", (index) =>
                  index.eq("testimonialId", testimonial._id),
                )
                .unique()
            : null,
          testimonial.moderationStatus === "spam"
            ? ctx.db
                .query("spamQuarantines")
                .withIndex("by_testimonial", (index) =>
                  index.eq("testimonialId", testimonial._id),
                )
                .order("desc")
                .first()
            : null,
        ]);
        if (!consent) testimonialUnavailable();
        const identity = {
          avatarUrl,
          company: testimonial.company,
          consentAcceptedAt: consent.acceptedAt,
          createdAt: testimonial.createdAt,
          moderationStatus: testimonial.moderationStatus,
          quarantineExpiresAt: quarantine?.expiresAt,
          rating: testimonial.rating,
          role: testimonial.role,
          submitterEmail: testimonial.submitterEmail,
          submitterName: testimonial.submitterName,
          spamCreditRestored: quarantine?.creditRestored,
          testimonialId: testimonial._id,
          publicVisibilityOverrides: testimonial.publicVisibilityOverrides,
        };
        if (testimonial.submissionType === "text") {
          return {
            ...identity,
            submissionType: "text" as const,
            text: testimonial.text,
          };
        }
        if (!videoAsset) testimonialUnavailable();
        return {
          ...identity,
          captionsStatus: videoAsset.captionsStatus,
          durationSeconds: videoAsset.durationSeconds,
          playbackId: videoAsset.playbackId,
          submissionType: "video" as const,
          videoStatus: videoAsset.status,
        };
      }),
    );
    return { ...page, page: inboxItems };
  },
});

const allowedTransitions: Record<InboxStatus, InboxStatus[]> = {
  pending: ["published", "archived"],
  published: ["archived"],
  archived: ["published"],
  spam: [],
};

async function restorePublishedProjection(
  ctx: MutationCtx,
  testimonial: Doc<"testimonials">,
  publishedAt: number,
) {
  await upsertPublicProjection(ctx, testimonial, publishedAt);
}

export const setStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    status: inboxStatusValidator,
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ moderationStatus: inboxStatusValidator }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await findTestimonial(
      ctx,
      access.organization._id,
      args.testimonialId,
    );
    if (testimonial.moderationStatus === "spam") testimonialUnavailable();
    if (testimonial.submissionType === "video") {
      const deletion = await ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique();
      if (deletion) {
        throw new ConvexError({
          code: "VIDEO_DELETION_IN_PROGRESS",
          message: "This Video Testimonial is being permanently deleted.",
        });
      }
    }
    if (testimonial.moderationStatus === args.status) {
      return { moderationStatus: args.status };
    }
    if (
      !allowedTransitions[testimonial.moderationStatus].includes(args.status)
    ) {
      throw new ConvexError({
        code: "INVALID_MODERATION_TRANSITION",
        message: `A ${testimonial.moderationStatus} Testimonial cannot become ${args.status}.`,
      });
    }

    const existingProjection = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    const now = Date.now();
    if (args.status === "published") {
      const entitlement = await getOrganizationBillingEntitlement(
        ctx,
        access.organization._id,
      );
      const retainedVideo =
        testimonial.submissionType === "video"
          ? await ctx.db
              .query("videoDowngradeRetentions")
              .withIndex("by_testimonial", (index) =>
                index.eq("testimonialId", testimonial._id),
              )
              .unique()
          : null;
      if (retainedVideo) {
        if (
          retainedVideo.status !== "retained" ||
          retainedVideo.expiresAt <= now
        ) {
          throw new ConvexError({
            code: "VIDEO_RETENTION_DELETION_IN_PROGRESS",
            message: "This retained video is being permanently deleted.",
          });
        }
        if (entitlement.effectivePlan !== "premium") {
          throw new ConvexError({
            code: "PRO_REQUIRED_FOR_VIDEO_REACTIVATION",
            message: "Reactivate Pro before republishing this retained video.",
          });
        }
        await cancelVideoRetentionForReactivation(ctx, testimonial._id);
      }
      if (entitlement.effectivePlan === "free") {
        const published = await ctx.db
          .query("publicTestimonialProjections")
          .withIndex("by_organization_published_at", (index) =>
            index.eq("organizationId", access.organization._id),
          )
          .collect();
        const limit = testimonial.submissionType === "video" ? 2 : 13;
        if (
          published.filter(
            (projection) => projection.type === testimonial.submissionType,
          ).length >= limit
        ) {
          throw new ConvexError({
            code: "FREE_PUBLICATION_LIMIT_REACHED",
            message: `Free can publish up to ${limit} ${testimonial.submissionType} Testimonials.`,
          });
        }
      }
      const publicOrderKey = await nextPublicOrderKey(
        ctx,
        access.organization._id,
      );
      await upsertPublicProjection(ctx, testimonial, now, publicOrderKey);
    } else if (existingProjection) {
      await ctx.db.delete(existingProjection._id);
    }

    await ctx.db.patch(testimonial._id, {
      moderationStatus: args.status,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType:
        args.status === "published"
          ? "testimonial.published"
          : "testimonial.archived",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "testimonial",
      targetId: String(testimonial._id),
      targetLabel: testimonial.submitterName,
      previousValue: testimonial.moderationStatus,
      newValue: args.status,
      occurredAt: now,
    });
    return { moderationStatus: args.status };
  },
});

const spamQuarantineDurationMs = 7 * 24 * 60 * 60 * 1_000;
const automaticSpamRestorationWindowMs = 30 * 24 * 60 * 60 * 1_000;
const automaticSpamRestorationLimit = 3;

export const markSpam = mutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ creditRestored: v.boolean(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await findTestimonial(
      ctx,
      access.organization._id,
      args.testimonialId,
    );
    if (testimonial.moderationStatus === "spam") {
      const existing = await ctx.db
        .query("spamQuarantines")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .order("desc")
        .first();
      if (!existing || existing.status !== "active") testimonialUnavailable();
      return {
        creditRestored: existing.creditRestored,
        expiresAt: existing.expiresAt,
      };
    }
    if (testimonial.submissionType === "video") {
      const deletion = await ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique();
      if (deletion) testimonialUnavailable();
    }
    const now = Date.now();
    const [credit, projection, recentReports] = await Promise.all([
      ctx.db
        .query("collectionCredits")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("spamQuarantines")
        .withIndex("by_organization_reported_at", (index) =>
          index
            .eq("organizationId", access.organization._id)
            .gte("reportedAt", now - automaticSpamRestorationWindowMs),
        )
        .collect(),
    ]);
    const automaticRestorations = recentReports.filter(
      ({ restorationMode }) => restorationMode === "automatic",
    ).length;
    const creditRestored = Boolean(
      credit &&
      credit.restoredAt === undefined &&
      automaticRestorations < automaticSpamRestorationLimit,
    );
    if (credit && creditRestored) {
      await ctx.db.patch(credit._id, {
        restorationMode: "automatic",
        restoredAt: now,
      });
    }
    if (projection) await ctx.db.delete(projection._id);
    const expiresAt = now + spamQuarantineDurationMs;
    const quarantineId = await ctx.db.insert("spamQuarantines", {
      creditRestored,
      expiresAt,
      organizationId: access.organization._id,
      previousModerationStatus: testimonial.moderationStatus,
      previousPublishedAt: projection?.publishedAt,
      previousPublicOrderKey: projection?.publicOrderKey,
      reportedAt: now,
      restorationMode: creditRestored ? "automatic" : undefined,
      status: "active",
      testimonialId: testimonial._id,
      updatedAt: now,
    });
    await ctx.db.patch(testimonial._id, {
      moderationStatus: "spam",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      spamQuarantineDurationMs,
      internal.testimonialModeration.expireSpamQuarantine,
      { quarantineId },
    );
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: access.principal.name,
      actorUserId: access.principal.actorId,
      eventType: "testimonial.spam_marked",
      newValue: creditRestored ? "credit_restored" : "quarantined",
      organizationId: access.organization._id,
      previousValue: testimonial.moderationStatus,
      targetId: String(testimonial._id),
      targetLabel: "Quarantined Testimonial",
      targetType: "testimonial",
    });
    return { creditRestored, expiresAt };
  },
});

export const undoSpam = mutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ moderationStatus: inboxStatusValidator }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await findTestimonial(
      ctx,
      access.organization._id,
      args.testimonialId,
    );
    const quarantine = await ctx.db
      .query("spamQuarantines")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .order("desc")
      .first();
    const now = Date.now();
    if (
      testimonial.moderationStatus !== "spam" ||
      !quarantine ||
      quarantine.status !== "active" ||
      quarantine.expiresAt <= now
    ) {
      testimonialUnavailable();
    }
    if (testimonial.submissionType === "video") {
      const deletion = await ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique();
      if (deletion) testimonialUnavailable();
    }
    const credit = quarantine.creditRestored
      ? await ctx.db
          .query("collectionCredits")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique()
      : null;
    if (credit) {
      await ctx.db.patch(credit._id, {
        restorationMode: undefined,
        restoredAt: undefined,
      });
    }
    if (quarantine.previousModerationStatus === "published") {
      await restorePublishedProjection(
        ctx,
        testimonial,
        quarantine.previousPublishedAt ?? now,
      );
    }
    await ctx.db.patch(testimonial._id, {
      moderationStatus: quarantine.previousModerationStatus,
      updatedAt: now,
    });
    await ctx.db.patch(quarantine._id, { status: "undone", updatedAt: now });
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: access.principal.name,
      actorUserId: access.principal.actorId,
      eventType: "testimonial.spam_undone",
      newValue: quarantine.previousModerationStatus,
      organizationId: access.organization._id,
      previousValue: "spam",
      targetId: String(testimonial._id),
      targetLabel: "Restored Testimonial",
      targetType: "testimonial",
    });
    return { moderationStatus: quarantine.previousModerationStatus };
  },
});

export const approveSpamCreditRestoration = internalMutation({
  args: {
    actorDisplayName: v.string(),
    quarantineId: v.id("spamQuarantines"),
  },
  returns: v.object({ restored: v.boolean() }),
  handler: async (ctx, args) => {
    const quarantine = await ctx.db.get(args.quarantineId);
    if (!quarantine || quarantine.status !== "active") {
      return { restored: false };
    }
    const credit = await ctx.db
      .query("collectionCredits")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", quarantine.testimonialId),
      )
      .unique();
    if (!credit || credit.restoredAt !== undefined) {
      return { restored: false };
    }
    const now = Date.now();
    await ctx.db.patch(credit._id, {
      restorationMode: "support",
      restoredAt: now,
    });
    await ctx.db.patch(quarantine._id, {
      creditRestored: true,
      restorationMode: "support",
      supportActor: args.actorDisplayName.trim().slice(0, 100) || "Support",
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: args.actorDisplayName.trim().slice(0, 100) || "Support",
      actorUserId: "support-operation",
      eventType: "testimonial.spam_credit_restored",
      newValue: "credit_restored",
      organizationId: quarantine.organizationId,
      previousValue: "manual_review",
      targetId: String(quarantine.testimonialId),
      targetLabel: "Quarantined Testimonial",
      targetType: "testimonial",
    });
    return { restored: true };
  },
});

export const expireSpamQuarantine = internalMutation({
  args: { quarantineId: v.id("spamQuarantines") },
  returns: v.object({ expired: v.boolean() }),
  handler: async (ctx, args) => {
    const quarantine = await ctx.db.get(args.quarantineId);
    const now = Date.now();
    if (!quarantine || quarantine.status !== "active") {
      return { expired: false };
    }
    if (quarantine.expiresAt > now) {
      await ctx.scheduler.runAfter(
        quarantine.expiresAt - now,
        internal.testimonialModeration.expireSpamQuarantine,
        args,
      );
      return { expired: false };
    }
    const testimonial = await ctx.db.get(quarantine.testimonialId);
    if (!testimonial || testimonial.moderationStatus !== "spam") {
      await ctx.db.patch(quarantine._id, { status: "expired", updatedAt: now });
      return { expired: true };
    }
    const [
      assets,
      consent,
      deliveries,
      priorAuditEvents,
      projection,
      replacementItems,
      retryLinks,
      revisions,
      deletion,
    ] = await Promise.all([
      ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
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
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", testimonial.organizationId)
            .eq("targetType", "testimonial")
            .eq("targetId", String(testimonial._id)),
        )
        .collect(),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
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
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
    if (deletion) {
      await ctx.scheduler.runAfter(
        60_000,
        internal.testimonialModeration.expireSpamQuarantine,
        args,
      );
      return { expired: false };
    }
    const [revisionAssets, retryAssets] = await Promise.all([
      Promise.all(
        revisions.map((revision) =>
          revision.videoAssetId ? ctx.db.get(revision.videoAssetId) : null,
        ),
      ),
      Promise.all(
        retryLinks.map((retryLink) => ctx.db.get(retryLink.videoAssetId)),
      ),
    ]);
    const allAssets = [...assets, ...revisionAssets, ...retryAssets].filter(
      (asset, index, candidates): asset is Doc<"videoAssets"> =>
        Boolean(asset) &&
        candidates.findIndex((candidate) => candidate?._id === asset?._id) ===
          index,
    );
    const cleanupTargets = allAssets.flatMap((asset) =>
      [
        asset.providerAssetId
          ? { asset, providerAssetId: asset.providerAssetId }
          : { asset, providerUploadId: asset.providerUploadId },
        asset.downloadProviderAssetId
          ? { asset, providerAssetId: asset.downloadProviderAssetId }
          : null,
      ].filter(Boolean),
    ) as Array<{
      asset: Doc<"videoAssets">;
      providerAssetId?: string;
      providerUploadId?: string;
    }>;
    const cleanupJobIds = await Promise.all(
      cleanupTargets.map(({ asset, ...target }) =>
        ctx.db.insert("videoProviderCleanupJobs", {
          attempts: 0,
          createdAt: now,
          organizationId: testimonial.organizationId,
          provider: asset.provider,
          ...target,
          testimonialId: testimonial._id,
        }),
      ),
    );
    await Promise.all(
      cleanupJobIds.map((cleanupJobId) =>
        ctx.scheduler.runAfter(0, internal.videoMedia.processProviderCleanup, {
          cleanupJobId,
        }),
      ),
    );
    if (projection) await ctx.db.delete(projection._id);
    if (consent) await ctx.db.delete(consent._id);
    await Promise.all(
      priorAuditEvents.map((event) =>
        ctx.db.patch(event._id, { targetLabel: "Deleted Testimonial" }),
      ),
    );
    await Promise.all([
      ...deliveries.map((delivery) => ctx.db.delete(delivery._id)),
      ...retryLinks.map((retryLink) => ctx.db.delete(retryLink._id)),
      ...revisions.map((revision) => ctx.db.delete(revision._id)),
      ...replacementItems.map((item) => ctx.db.delete(item._id)),
      ...allAssets.map((asset) => ctx.db.delete(asset._id)),
    ]);
    const replacementRequestIds = [
      ...new Set(replacementItems.map((item) => item.requestId)),
    ];
    await Promise.all(
      replacementRequestIds.map(async (requestId) => {
        const remaining = await ctx.db
          .query("managementLinkReplacementItems")
          .withIndex("by_request", (index) => index.eq("requestId", requestId))
          .first();
        const request = remaining ? null : await ctx.db.get(requestId);
        if (request) await ctx.db.delete(request._id);
      }),
    );
    const reservationIds = new Set([
      ...allAssets.map((asset) => asset.reservationId),
      ...revisions.map((revision) => revision.reservationId),
    ]);
    const reservations = await Promise.all(
      [...reservationIds].map((reservationId) => ctx.db.get(reservationId)),
    );
    await Promise.all(
      reservations.map((reservation) =>
        reservation ? ctx.db.delete(reservation._id) : Promise.resolve(),
      ),
    );
    if (testimonial.avatarStorageId) {
      await ctx.storage.delete(testimonial.avatarStorageId);
    }
    await ctx.db.delete(testimonial._id);
    await ctx.db.patch(quarantine._id, { status: "expired", updatedAt: now });
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: "System",
      actorUserId: "spam-quarantine-expiry",
      eventType: "testimonial.spam_expired",
      newValue: "deleted",
      organizationId: testimonial.organizationId,
      previousValue: "spam",
      targetId: String(testimonial._id),
      targetLabel: "Expired Spam",
      targetType: "testimonial",
    });
    return { expired: true };
  },
});

export const remove = mutation({
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
    const testimonial = await findTestimonial(
      ctx,
      access.organization._id,
      args.testimonialId,
    );
    if (testimonial.moderationStatus === "spam") testimonialUnavailable();
    if (testimonial.submissionType === "video") {
      throw new ConvexError({
        code: "VIDEO_DELETION_REQUIRES_MEDIA_ACTION",
        message:
          "Video Testimonials must be deleted through the media deletion workflow.",
      });
    }
    const [consent, deliveries, projection, replacementItems] =
      await Promise.all([
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
          .query("managementLinkReplacementItems")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .collect(),
      ]);
    if (projection) await ctx.db.delete(projection._id);
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
    if (testimonial.avatarStorageId) {
      await ctx.storage.delete(testimonial.avatarStorageId);
    }
    await ctx.db.delete(testimonial._id);
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "testimonial.deleted",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "testimonial",
      targetId: String(testimonial._id),
      targetLabel: "Deleted Testimonial",
      previousValue: testimonial.moderationStatus,
      occurredAt: Date.now(),
    });
    return { deleted: true };
  },
});
