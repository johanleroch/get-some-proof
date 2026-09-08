import { projectionIsPublic } from "./publicProjection";
import { isProjectActive } from "./projectActivity";
import { resolveTestimonialImages } from "./testimonialImages";
import { ConvexError, v } from "convex/values";
import {
  requirePublicWallServer,
  validPublicWallSlug,
} from "./security/publicWallAccess";

import { query } from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { accentInk } from "./domain/colorContrast";
import { organizationPublicVisibility } from "./publicProjection";
import { testimonialCardValue } from "./testimonialCardValue";

export const getBrand = query({
  args: { publicSlug: v.string(), secret: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      accentColor: v.string(),
      accentInk: v.string(),
      attributionRequired: v.boolean(),
      brandName: v.string(),
      hasPublishedTestimonials: v.boolean(),
      publicSlug: v.string(),
      privacyRevision: v.number(),
      theme: v.union(
        v.literal("light"),
        v.literal("dark"),
        v.literal("system"),
      ),
      transparentEmbed: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    requirePublicWallServer(args.secret);
    if (!validPublicWallSlug(args.publicSlug))
      throw new ConvexError("Invalid Public Wall request.");
    const publicSlug = args.publicSlug;
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", publicSlug),
      )
      .unique();
    if (!brand || !(await isProjectActive(ctx, brand))) return null;
    const [entitlement, firstProjection] = await Promise.all([
      getOrganizationBillingEntitlement(ctx, brand._id),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_organization_order_key", (index) =>
          index.eq("organizationId", brand._id),
        )
        .order("desc")
        .first(),
    ]);
    const accentColor = brand.publicWallAccentColor ?? brand.primaryColor;
    return {
      accentColor,
      accentInk: accentInk(accentColor),
      attributionRequired: entitlement.effectivePlan === "free",
      brandName: brand.name,
      hasPublishedTestimonials: firstProjection !== null,
      publicSlug: brand.publicSlug,
      privacyRevision:
        (brand.publicWallPrivacyRevision ?? 0) +
        (brand.accountId
          ? ((await ctx.db.get(brand.accountId))?.publicationGeneration ?? 0)
          : 0),
      theme: brand.publicWallTheme ?? "system",
      transparentEmbed: brand.publicWallTransparentEmbed ?? false,
    };
  },
});

export const list = query({
  args: {
    secret: v.optional(v.string()),
    paginationOpts: v.object({
      cursor: v.union(v.string(), v.null()),
      numItems: v.number(),
    }),
    publicSlug: v.string(),
  },
  handler: async (ctx, args) => {
    requirePublicWallServer(args.secret);
    if (!validPublicWallSlug(args.publicSlug))
      throw new ConvexError("Invalid Public Wall request.");
    const publicSlug = args.publicSlug;
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50 ||
      (args.paginationOpts.cursor?.length ?? 0) > 1024
    ) {
      throw new ConvexError("Invalid Public Wall pagination.");
    }
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", publicSlug),
      )
      .unique();
    if (!brand || !(await isProjectActive(ctx, brand))) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_order_key", (index) =>
        index.eq("organizationId", brand._id),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: 50,
        maximumBytesRead: 512_000,
      });
    const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
    const testimonials = await Promise.all(
      page.page
        .filter((projection) => projectionIsPublic(account, projection))
        .map(async (projection) => {
          const defaults = organizationPublicVisibility(brand);
          const visible = {
            avatar: projection.visibilityOverrides?.avatar ?? defaults.avatar,
            company:
              projection.visibilityOverrides?.company ?? defaults.company,
            rating: projection.visibilityOverrides?.rating ?? defaults.rating,
            role: projection.visibilityOverrides?.role ?? defaults.role,
          };
          const identity = {
            avatarUrl: projection.avatarStorageId
              ? visible.avatar
                ? await ctx.storage.getUrl(projection.avatarStorageId)
                : null
              : null,
            avatarVisible: visible.avatar,
            company: visible.company ? projection.company : undefined,
            id: projection._id,
            name: projection.name,
            publishedAt: projection.publishedAt,
            rating: visible.rating ? projection.rating : undefined,
            role: visible.role ? projection.role : undefined,
          };
          return projection.type === "video"
            ? testimonialCardValue(identity, {
                aspectRatio: projection.aspectRatio,
                captionsAvailable: projection.captionsAvailable,
                playbackId: projection.playbackId,
                posterTimeSeconds: projection.posterTimeSeconds,
                type: "video" as const,
              })
            : testimonialCardValue(identity, {
                text: projection.text,
                richText: projection.richText,
                images: projection.imageIds?.length
                  ? await resolveTestimonialImages(ctx, projection.imageIds)
                  : undefined,
                type: "text" as const,
              });
        }),
    );
    return { ...page, page: testimonials };
  },
});

// Intentionally public: one indexed Brand read, no testimonial or storage hydration.
// Privacy removals invalidate already-rendered pages without exposing the server credential.
export const privacyRevision = query({
  args: { publicSlug: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { publicSlug }) => {
    if (!validPublicWallSlug(publicSlug)) return null;
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (q) => q.eq("publicSlug", publicSlug))
      .unique();
    return !brand || !(await isProjectActive(ctx, brand))
      ? null
      : (brand.publicWallPrivacyRevision ?? 0) +
          (brand.accountId
            ? ((await ctx.db.get(brand.accountId))?.publicationGeneration ?? 0)
            : 0);
  },
});
