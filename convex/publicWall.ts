import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { query } from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { organizationPublicVisibility } from "./publicProjection";

export const getBrand = query({
  args: { publicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      accentColor: v.string(),
      attributionRequired: v.boolean(),
      brandName: v.string(),
      hasPublishedTestimonials: v.boolean(),
      publicSlug: v.string(),
      theme: v.union(
        v.literal("light"),
        v.literal("dark"),
        v.literal("system"),
      ),
      transparentEmbed: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const publicSlug = args.publicSlug.trim().toLowerCase();
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", publicSlug),
      )
      .unique();
    if (!brand || brand.deletionStartedAt !== undefined) return null;
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
    return {
      accentColor: brand.publicWallAccentColor ?? brand.primaryColor,
      attributionRequired:
        entitlement.effectivePlan === "free" ||
        brand.publicWallHideAttribution !== true,
      brandName: brand.name,
      hasPublishedTestimonials: firstProjection !== null,
      publicSlug: brand.publicSlug,
      theme: brand.publicWallTheme ?? "system",
      transparentEmbed: brand.publicWallTransparentEmbed ?? false,
    };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    publicSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const publicSlug = args.publicSlug.trim().toLowerCase();
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", publicSlug),
      )
      .unique();
    if (!brand || brand.deletionStartedAt !== undefined) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_order_key", (index) =>
        index.eq("organizationId", brand._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const testimonials = await Promise.all(
      page.page.map(async (projection) => {
        const defaults = organizationPublicVisibility(brand);
        const visible = {
          avatar: projection.visibilityOverrides?.avatar ?? defaults.avatar,
          company: projection.visibilityOverrides?.company ?? defaults.company,
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
          ? {
              ...identity,
              aspectRatio: projection.aspectRatio,
              captionsAvailable: projection.captionsAvailable,
              playbackId: projection.playbackId,
              posterTimeSeconds: projection.posterTimeSeconds,
              type: "video" as const,
            }
          : { ...identity, text: projection.text, type: "text" as const };
      }),
    );
    return { ...page, page: testimonials };
  },
});
