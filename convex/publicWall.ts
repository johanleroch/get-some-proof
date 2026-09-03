import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { query } from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";

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
    if (!brand) return null;
    const [entitlement, firstProjection] = await Promise.all([
      getOrganizationBillingEntitlement(ctx, brand._id),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_organization_published_at", (index) =>
          index.eq("organizationId", brand._id),
        )
        .order("desc")
        .first(),
    ]);
    return {
      accentColor: brand.primaryColor,
      attributionRequired: entitlement.effectivePlan === "free",
      brandName: brand.name,
      hasPublishedTestimonials: firstProjection !== null,
      publicSlug: brand.publicSlug,
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
    if (!brand) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_published_at", (index) =>
        index.eq("organizationId", brand._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const testimonials = await Promise.all(
      page.page.map(async (projection) => ({
        avatarUrl: projection.avatarStorageId
          ? await ctx.storage.getUrl(projection.avatarStorageId)
          : null,
        company: projection.company,
        id: projection._id,
        name: projection.name,
        publishedAt: projection.publishedAt,
        rating: projection.rating,
        role: projection.role,
        text: projection.text,
        type: projection.type,
      })),
    );
    return { ...page, page: testimonials };
  },
});
