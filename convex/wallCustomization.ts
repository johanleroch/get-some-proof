import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import {
  defaultPublicVisibility,
  organizationPublicVisibility,
  publicOrderKeyBetween,
} from "./publicProjection";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { normalizePrimaryColor } from "./domain/brand";

const themeValidator = v.union(
  v.literal("light"),
  v.literal("dark"),
  v.literal("system"),
);
const visibilityValidator = v.object({
  avatar: v.boolean(),
  company: v.boolean(),
  rating: v.boolean(),
  role: v.boolean(),
});
const overridesValidator = v.object({
  avatar: v.optional(v.boolean()),
  company: v.optional(v.boolean()),
  rating: v.optional(v.boolean()),
  role: v.optional(v.boolean()),
});

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID_WALL_CUSTOMIZATION", message });
}

function migratedOrderKey(value: string | undefined) {
  if (!value) {
    invalid("The Published Testimonial order is still being prepared.");
  }
  return value;
}

async function gapContents(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  beforeKey?: string,
  afterKey?: string,
) {
  return await ctx.db
    .query("publicTestimonialProjections")
    .withIndex("by_organization_order_key", (index) => {
      const organization = index.eq("organizationId", organizationId);
      if (beforeKey && afterKey) {
        return organization
          .gt("publicOrderKey", afterKey)
          .lt("publicOrderKey", beforeKey);
      }
      if (beforeKey) return organization.lt("publicOrderKey", beforeKey);
      if (afterKey) return organization.gt("publicOrderKey", afterKey);
      return organization;
    })
    .take(2);
}

export const getSettings = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    accentColor: v.string(),
    canHideAttribution: v.boolean(),
    hideAttribution: v.boolean(),
    theme: themeValidator,
    transparentEmbed: v.boolean(),
    visibility: visibilityValidator,
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:read",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    const canHideAttribution = entitlement.effectivePlan === "premium";
    return {
      accentColor:
        access.organization.publicWallAccentColor ??
        access.organization.primaryColor,
      canHideAttribution,
      hideAttribution:
        canHideAttribution &&
        access.organization.publicWallHideAttribution === true,
      theme: access.organization.publicWallTheme ?? "system",
      transparentEmbed: access.organization.publicWallTransparentEmbed ?? false,
      visibility: organizationPublicVisibility(access.organization),
    };
  },
});

export const listPublished = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:read",
    );
    const projections = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_order_key", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const testimonials = await Promise.all(
      projections.page.map((projection) =>
        ctx.db.get(projection.testimonialId),
      ),
    );
    return {
      ...projections,
      page: testimonials.flatMap((testimonial) =>
        testimonial && testimonial.moderationStatus === "published"
          ? [
              {
                overrides: testimonial.publicVisibilityOverrides,
                submissionType: testimonial.submissionType,
                submitterName: testimonial.submitterName,
                testimonialId: testimonial._id,
              },
            ]
          : [],
      ),
    };
  },
});

export const updateSettings = mutation({
  args: {
    accentColor: v.string(),
    hideAttribution: v.boolean(),
    organizationId: v.id("organizations"),
    theme: themeValidator,
    transparentEmbed: v.boolean(),
    visibility: visibilityValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    if (args.hideAttribution && entitlement.effectivePlan !== "premium") {
      invalid("Only Pro can remove the Attribution Badge.");
    }
    let accentColor: string;
    try {
      accentColor = normalizePrimaryColor(args.accentColor);
    } catch (error) {
      invalid(error instanceof Error ? error.message : "Invalid accent color.");
    }
    const now = Date.now();
    await ctx.db.patch(access.organization._id, {
      publicWallAccentColor: accentColor,
      publicWallHideAttribution: args.hideAttribution,
      publicWallTheme: args.theme,
      publicWallTransparentEmbed: args.transparentEmbed,
      publicWallVisibility: args.visibility,
      updatedAt: now,
    });
    return null;
  },
});

export const setTestimonialVisibility = mutation({
  args: {
    organizationId: v.id("organizations"),
    overrides: overridesValidator,
    testimonialId: v.id("testimonials"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id ||
      testimonial.moderationStatus !== "published"
    ) {
      invalid("Only a Published Testimonial can customize public fields.");
    }
    const projection = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!projection) invalid("Published Testimonial unavailable.");
    await ctx.db.patch(testimonial._id, {
      publicVisibilityOverrides: args.overrides,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(projection._id, {
      visibilityOverrides: args.overrides,
    });
    return null;
  },
});

export const movePublished = mutation({
  args: {
    afterTestimonialId: v.optional(v.id("testimonials")),
    beforeTestimonialId: v.optional(v.id("testimonials")),
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const ids = [
      args.testimonialId,
      args.beforeTestimonialId,
      args.afterTestimonialId,
    ].filter((id): id is NonNullable<typeof id> => id !== undefined);
    if (new Set(ids.map(String)).size !== ids.length) {
      invalid("A Testimonial cannot be positioned relative to itself.");
    }
    const [projection, before, after] = await Promise.all(
      [
        args.testimonialId,
        args.beforeTestimonialId,
        args.afterTestimonialId,
      ].map((testimonialId) =>
        testimonialId
          ? ctx.db
              .query("publicTestimonialProjections")
              .withIndex("by_testimonial", (index) =>
                index.eq("testimonialId", testimonialId),
              )
              .unique()
          : null,
      ),
    );
    if (
      !projection ||
      [projection, before, after].some(
        (item) => item && item.organizationId !== access.organization._id,
      )
    ) {
      invalid("The Published Testimonial order changed. Refresh and retry.");
    }
    const contents = await gapContents(
      ctx,
      access.organization._id,
      before ? migratedOrderKey(before.publicOrderKey) : undefined,
      after ? migratedOrderKey(after.publicOrderKey) : undefined,
    );
    if (contents.some(({ _id }) => _id !== projection._id)) {
      invalid("The Published Testimonial order changed. Refresh and retry.");
    }
    const publicOrderKey = publicOrderKeyBetween(
      before ? migratedOrderKey(before.publicOrderKey) : undefined,
      after ? migratedOrderKey(after.publicOrderKey) : undefined,
    );
    await ctx.db.patch(projection._id, {
      publicOrderKey,
    });
    await ctx.db.patch(access.organization._id, {
      publicWallOrderVersion:
        (access.organization.publicWallOrderVersion ?? 0) + 1,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export { defaultPublicVisibility };
