import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import schema from "./schema";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { requirePublicWallServer } from "./security/publicWallAccess";
import { isProjectActive } from "./projectActivity";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { projectionIsPublic } from "./publicProjection";
import { hydratePublicProjection } from "./publicProjectionHydration";
import { testimonialCardValueValidator } from "./testimonialCardValue";
import {
  invalidWidget,
  MAX_WIDGETS,
  MAX_WIDGET_TESTIMONIALS,
  normalizeWidgetConfig,
  normalizeWidgetName,
  widgetConfigValidator,
  type WidgetConfig,
} from "./domain/widgets";

const scope = {
  organizationId: v.id("organizations"),
  widgetId: v.id("widgets"),
};
const candidateValidator = v.object({
  testimonialId: v.id("testimonials"),
  card: testimonialCardValueValidator,
});
const widgetValidator = schema.doc("widgets");

async function requireTemplateAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  config: WidgetConfig,
) {
  if (config.layout === "wall") return;
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  if (entitlement.effectivePlan !== "premium")
    throw new ConvexError({
      code: "PREMIUM_REQUIRED",
      message:
        "This template requires Pro. Wall of Fame is available for free.",
    });
}

async function owned(
  ctx: QueryCtx,
  args: { organizationId: Id<"organizations">; widgetId: Id<"widgets"> },
  write = false,
) {
  const access = await requireOrganizationPermission(
    ctx,
    { organizationId: args.organizationId },
    write ? "ownership:manage" : "organization:read",
  );
  const widget = await ctx.db.get(args.widgetId);
  if (!widget || widget.organizationId !== access.organization._id)
    throw new ConvexError("Widget not found.");
  return { widget, brand: access.organization };
}
function checkRevision(widget: Doc<"widgets">, expected: number) {
  if (widget.revision !== expected)
    throw new ConvexError({
      code: "WIDGET_CHANGED",
      message: "This widget changed in another tab. Reload it before saving.",
    });
}
function hasHighlight(projection: Doc<"publicTestimonialProjections">) {
  return (
    projection.type === "text" &&
    projection.richText?.some((block) =>
      block.children.some(
        (leaf) => leaf.highlight && leaf.text.trim().length > 0,
      ),
    )
  );
}
async function selected(
  ctx: QueryCtx,
  brand: Doc<"organizations">,
  ids: Id<"testimonials">[],
  config: WidgetConfig,
  strict = false,
) {
  if (ids.length > MAX_WIDGET_TESTIMONIALS || new Set(ids).size !== ids.length)
    invalidWidget("Select up to 50 different testimonials.");
  if (config.layout === "individual" && ids.length > 1)
    invalidWidget("An individual widget displays one testimonial.");
  const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
  const result = [];
  for (const testimonialId of ids) {
    const projection = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_testimonial", (q) => q.eq("testimonialId", testimonialId))
      .unique();
    if (
      !projection ||
      projection.organizationId !== brand._id ||
      !projectionIsPublic(account, projection)
    ) {
      if (strict)
        invalidWidget(
          "Choose testimonials that are currently published in this project.",
        );
      continue;
    }
    if (config.layout === "highlights" && !hasHighlight(projection)) {
      if (strict)
        invalidWidget(
          "Highlights needs text testimonials with highlighted words.",
        );
      continue;
    }
    result.push({
      testimonialId,
      card: await hydratePublicProjection(
        ctx,
        brand,
        projection,
        config.testimonialLinksEnabled ??
          account?.testimonialLinksEnabled ??
          true,
      ),
    });
  }
  return result;
}
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    config: widgetConfigValidator,
  },
  returns: v.id("widgets"),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    await requireTemplateAccess(ctx, args.organizationId, args.config);
    const existing = await ctx.db
      .query("widgets")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(MAX_WIDGETS);
    if (existing.length >= MAX_WIDGETS)
      invalidWidget("This project already has 100 widgets.");
    const now = Date.now();
    return ctx.db.insert("widgets", {
      organizationId: args.organizationId,
      publicId: crypto.randomUUID(),
      name: normalizeWidgetName(args.name),
      draft: { config: normalizeWidgetConfig(args.config), testimonialIds: [] },
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const save = mutation({
  args: {
    ...scope,
    expectedRevision: v.number(),
    publish: v.optional(v.boolean()),
    name: v.string(),
    config: widgetConfigValidator,
    testimonialIds: v.array(v.id("testimonials")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { widget, brand } = await owned(ctx, args, true);
    checkRevision(widget, args.expectedRevision);
    const config = normalizeWidgetConfig(args.config);
    await requireTemplateAccess(ctx, brand._id, config);
    if (args.publish && !args.testimonialIds.length)
      invalidWidget("Select at least one testimonial before publishing.");
    await selected(ctx, brand, args.testimonialIds, config, true);
    const now = Date.now();
    const draft = { config, testimonialIds: args.testimonialIds };
    await ctx.db.patch(widget._id, {
      name: normalizeWidgetName(args.name),
      draft,
      ...(args.publish ? { published: draft, publishedAt: now } : {}),
      revision: widget.revision + 1,
      updatedAt: now,
    });
    return null;
  },
});
export const publish = mutation({
  args: { ...scope, expectedRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { widget, brand } = await owned(ctx, args, true);
    checkRevision(widget, args.expectedRevision);
    await requireTemplateAccess(ctx, brand._id, widget.draft.config);
    if (!widget.draft.testimonialIds.length)
      invalidWidget("Select at least one testimonial before publishing.");
    await selected(
      ctx,
      brand,
      widget.draft.testimonialIds,
      widget.draft.config,
      true,
    );
    const now = Date.now();
    await ctx.db.patch(widget._id, {
      published: widget.draft,
      publishedAt: now,
      updatedAt: now,
      revision: widget.revision + 1,
    });
    return null;
  },
});
export const unpublish = mutation({
  args: scope,
  returns: v.number(),
  handler: async (ctx, args) => {
    const { widget } = await owned(ctx, args, true);
    await ctx.db.patch(widget._id, {
      published: undefined,
      publishedAt: undefined,
      updatedAt: Date.now(),
      revision: widget.revision + 1,
    });
    return widget.revision + 1;
  },
});
export const remove = mutation({
  args: scope,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { widget } = await owned(ctx, args, true);
    await ctx.db.delete(widget._id);
    return null;
  },
});
export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(widgetValidator),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(ctx, args, "organization:read");
    return ctx.db
      .query("widgets")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(MAX_WIDGETS);
  },
});
export const get = query({
  args: scope,
  returns: v.union(
    v.null(),
    widgetValidator.extend({ draftTestimonials: v.array(candidateValidator) }),
  ),
  handler: async (ctx, args) => {
    const { widget, brand } = await owned(ctx, args);
    const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
    return {
      ...widget,
      draft: {
        ...widget.draft,
        config: {
          ...widget.draft.config,
          testimonialLinksEnabled:
            widget.draft.config.testimonialLinksEnabled ??
            account?.testimonialLinksEnabled ??
            true,
        },
      },
      draftTestimonials: await selected(
        ctx,
        brand,
        widget.draft.testimonialIds,
        { ...widget.draft.config, testimonialLinksEnabled: true },
      ),
    };
  },
});
export const candidates = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(candidateValidator),
  handler: async (ctx, args) => {
    const { organization: brand } = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:read",
    );
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    )
      invalidWidget("Request between 1 and 50 testimonials.");
    const page = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization_order_key", (q) =>
        q.eq("organizationId", brand._id),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: 50,
        maximumBytesRead: 512000,
      });
    const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
    const items = await Promise.all(
      page.page
        .filter((projection) => projectionIsPublic(account, projection))
        .map(async (projection) => ({
          testimonialId: projection.testimonialId,
          card: await hydratePublicProjection(ctx, brand, projection, true),
        })),
    );
    return { ...page, page: items };
  },
});
async function publicWidget(ctx: QueryCtx, publicId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      publicId,
    )
  )
    return null;
  const widget = await ctx.db
    .query("widgets")
    .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
    .unique();
  if (!widget?.published) return null;
  const brand = await ctx.db.get(widget.organizationId);
  if (!brand || !(await isProjectActive(ctx, brand))) return null;
  if (widget.published.config.layout !== "wall") {
    const entitlement = await getOrganizationBillingEntitlement(ctx, brand._id);
    if (entitlement.effectivePlan !== "premium") return null;
  }
  return { widget, brand };
}
async function revision(
  ctx: QueryCtx,
  brand: Doc<"organizations">,
  widget: Doc<"widgets">,
) {
  const account = brand.accountId ? await ctx.db.get(brand.accountId) : null;
  return (
    widget.revision +
    (brand.publicWallPrivacyRevision ?? 0) +
    (account?.publicationGeneration ?? 0) +
    (account?.testimonialLinksRevision ?? 0)
  );
}
/** Lookup only: public admission must complete before card/storage hydration. */
export const getPublishedBrand = query({
  args: { publicId: v.string(), secret: v.optional(v.string()) },
  returns: v.union(v.null(), v.object({ publicSlug: v.string() })),
  handler: async (ctx, args) => {
    requirePublicWallServer(args.secret);
    const value = await publicWidget(ctx, args.publicId);
    return value ? { publicSlug: value.brand.publicSlug } : null;
  },
});

export const getPublished = query({
  args: { publicId: v.string(), secret: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      publicId: v.string(),
      brandName: v.string(),
      publicSlug: v.string(),
      config: widgetConfigValidator,
      testimonials: v.array(testimonialCardValueValidator),
      attributionRequired: v.boolean(),
      privacyRevision: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    requirePublicWallServer(args.secret);
    const value = await publicWidget(ctx, args.publicId);
    if (!value) return null;
    const { widget, brand } = value;
    const snapshot = widget.published!;
    const entitlement = await getOrganizationBillingEntitlement(ctx, brand._id);
    return {
      publicId: widget.publicId,
      brandName: brand.name,
      publicSlug: brand.publicSlug,
      config: snapshot.config,
      testimonials: (
        await selected(ctx, brand, snapshot.testimonialIds, snapshot.config)
      ).map((item) => item.card),
      attributionRequired: entitlement.effectivePlan === "free",
      privacyRevision: await revision(ctx, brand, widget),
    };
  },
});
export const privacyRevision = query({
  args: { publicId: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const value = await publicWidget(ctx, args.publicId);
    return value ? revision(ctx, value.brand, value.widget) : null;
  },
});
