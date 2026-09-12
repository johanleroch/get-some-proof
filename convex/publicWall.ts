import { hydratePublicProjection } from "./publicProjectionHydration";
import { projectionIsPublic } from "./publicProjection";
import { isProjectActive } from "./projectActivity";
import { ConvexError, v } from "convex/values";
import {
  requirePublicWallServer,
  validPublicWallSlug,
} from "./security/publicWallAccess";

import { query } from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { accentInk } from "./domain/colorContrast";

export const getBrand = query({
  args: { publicSlug: v.string(), secret: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      accentColor: v.string(),
      accentInk: v.string(),
      attributionRequired: v.boolean(),
      brandName: v.string(),
      logoUrl: v.union(v.string(), v.null()),
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
    const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
    return {
      accentColor,
      accentInk: accentInk(accentColor),
      attributionRequired: entitlement.effectivePlan === "free",
      brandName: brand.name,
      logoUrl: brand.logoStorageId
        ? await ctx.storage.getUrl(brand.logoStorageId)
        : null,
      hasPublishedTestimonials: firstProjection !== null,
      publicSlug: brand.publicSlug,
      privacyRevision:
        (brand.publicWallPrivacyRevision ?? 0) +
        (account?.publicationGeneration ?? 0) +
        (account?.testimonialLinksRevision ?? 0),
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
        .map((projection) =>
          hydratePublicProjection(
            ctx,
            brand,
            projection,
            brand.publicWallTestimonialLinksEnabled ??
              account?.testimonialLinksEnabled ??
              true,
          ),
        ),
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
    const account = brand?.accountId ? await ctx.db.get(brand.accountId) : null;
    return !brand || !(await isProjectActive(ctx, brand))
      ? null
      : (brand.publicWallPrivacyRevision ?? 0) +
          (account?.publicationGeneration ?? 0) +
          (account?.testimonialLinksRevision ?? 0);
  },
});
