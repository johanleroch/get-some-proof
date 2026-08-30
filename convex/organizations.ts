import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authzForOrganization } from "./authorization";
import {
  buildOrganizationSlug,
  normalizeOrganizationName,
  randomSlugSuffix,
} from "./domain/organizationSlug";
import { requireVerifiedPrincipal } from "./security/principal";

const organizationSummary = v.object({
  id: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.object({
    id: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    actorId: v.string(),
  }),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    let name: string;

    try {
      name = normalizeOrganizationName(args.name);
    } catch (error) {
      throw new ConvexError({
        code: "INVALID_ORGANIZATION_NAME",
        message:
          error instanceof Error ? error.message : "Invalid Organization name.",
      });
    }

    let slug: string | undefined;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = buildOrganizationSlug(name, randomSlugSuffix());
      const existing = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (index) => index.eq("slug", candidate))
        .unique();

      if (!existing) {
        slug = candidate;
        break;
      }
    }

    if (!slug) {
      throw new ConvexError({
        code: "ORGANIZATION_SLUG_UNAVAILABLE",
        message: "Could not allocate a unique Organization URL. Try again.",
      });
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      createdByUserId: principal.actorId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("memberships", {
      organizationId,
      userId: principal.actorId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await authzForOrganization(String(organizationId)).assignRole(
      ctx,
      principal.actorId,
      "owner",
      undefined,
      undefined,
      principal.actorId,
    );

    return {
      id: organizationId,
      name,
      slug,
      actorId: principal.actorId,
    };
  },
});

export const listMine = query({
  args: {},
  returns: v.array(organizationSummary),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user_status", (index) =>
        index.eq("userId", principal.actorId).eq("status", "active"),
      )
      .collect();

    const organizations = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.organizationId)),
    );

    return organizations
      .filter((organization) => organization !== null)
      .map((organization) => ({
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(v.null(), organizationSummary),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", args.slug))
      .unique();

    if (!organization) {
      return null;
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (index) =>
        index
          .eq("organizationId", organization._id)
          .eq("userId", principal.actorId),
      )
      .unique();

    if (!membership || membership.status !== "active") {
      return null;
    }

    return {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
    };
  },
});

export const rename = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: organizationSummary,
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      throw new ConvexError({
        code: "ORGANIZATION_UNAVAILABLE",
        message: "Organization unavailable.",
      });
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (index) =>
        index
          .eq("organizationId", organization._id)
          .eq("userId", principal.actorId),
      )
      .unique();

    if (!membership || membership.status !== "active") {
      throw new ConvexError({
        code: "ORGANIZATION_UNAVAILABLE",
        message: "Organization unavailable.",
      });
    }

    await authzForOrganization(String(organization._id)).require(
      ctx,
      principal.actorId,
      "organization:update",
    );

    let name: string;
    try {
      name = normalizeOrganizationName(args.name);
    } catch (error) {
      throw new ConvexError({
        code: "INVALID_ORGANIZATION_NAME",
        message:
          error instanceof Error ? error.message : "Invalid Organization name.",
      });
    }

    await ctx.db.patch(organization._id, {
      name,
      updatedAt: Date.now(),
    });

    return {
      id: organization._id,
      name,
      slug: organization.slug,
    };
  },
});
