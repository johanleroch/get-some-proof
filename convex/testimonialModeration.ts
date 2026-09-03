import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { requireOrganizationPermission } from "./security/organizationAccess";

const inboxStatusValidator = v.union(
  v.literal("pending"),
  v.literal("published"),
  v.literal("archived"),
);
type InboxStatus = "pending" | "published" | "archived";

const inboxIdentityValidator = {
  avatarUrl: v.union(v.null(), v.string()),
  company: v.optional(v.string()),
  consentAcceptedAt: v.number(),
  createdAt: v.number(),
  moderationStatus: inboxStatusValidator,
  rating: v.optional(v.number()),
  role: v.optional(v.string()),
  submitterEmail: v.string(),
  submitterName: v.string(),
  testimonialId: v.id("testimonials"),
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
    const visibleQuery = indexedQuery.filter((filter) =>
      args.submissionType
        ? filter.and(
            filter.neq(filter.field("moderationStatus"), "spam"),
            filter.eq(filter.field("submissionType"), args.submissionType),
          )
        : filter.neq(filter.field("moderationStatus"), "spam"),
    );
    const page = await visibleQuery
      .order(args.sort === "newest" ? "desc" : "asc")
      .paginate(args.paginationOpts);

    const inboxItems = await Promise.all(
      page.page.map(async (testimonial) => {
        if (testimonial.moderationStatus === "spam") testimonialUnavailable();
        const [avatarUrl, consent, videoAsset] = await Promise.all([
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
        ]);
        if (!consent) testimonialUnavailable();
        const identity = {
          avatarUrl,
          company: testimonial.company,
          consentAcceptedAt: consent.acceptedAt,
          createdAt: testimonial.createdAt,
          moderationStatus: testimonial.moderationStatus,
          rating: testimonial.rating,
          role: testimonial.role,
          submitterEmail: testimonial.submitterEmail,
          submitterName: testimonial.submitterName,
          testimonialId: testimonial._id,
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
};

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
      const [consent, videoAsset] = await Promise.all([
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
      ]);
      if (!consent) testimonialUnavailable();
      if (
        testimonial.submissionType === "video" &&
        (!videoAsset || videoAsset.status !== "ready" || !videoAsset.playbackId)
      ) {
        throw new ConvexError({
          code: "VIDEO_NOT_READY",
          message: "Only a Ready video Testimonial can be Published.",
        });
      }
      const fields = new Set(consent.identityFields);
      const identity = {
        avatarStorageId: fields.has("avatar")
          ? testimonial.avatarStorageId
          : undefined,
        company: fields.has("company") ? testimonial.company : undefined,
        name: testimonial.submitterName,
        organizationId: testimonial.organizationId,
        publishedAt: now,
        rating: fields.has("rating") ? testimonial.rating : undefined,
        role: fields.has("role") ? testimonial.role : undefined,
        testimonialId: testimonial._id,
      };
      const projection =
        testimonial.submissionType === "video" && videoAsset
          ? {
              ...identity,
              captionsAvailable: videoAsset.captionsStatus === "ready",
              playbackId: videoAsset.playbackId!,
              posterTimeSeconds: videoAsset.durationSeconds
                ? videoAsset.durationSeconds / 2
                : undefined,
              type: "video" as const,
            }
          : {
              ...identity,
              text: testimonial.text,
              type: "text" as const,
            };
      if (existingProjection) {
        await ctx.db.replace(existingProjection._id, projection);
      } else {
        await ctx.db.insert("publicTestimonialProjections", projection);
      }
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
    const [consent, deliveries, projection] = await Promise.all([
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
    ]);
    if (projection) await ctx.db.delete(projection._id);
    for (const delivery of deliveries) await ctx.db.delete(delivery._id);
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
