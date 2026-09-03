import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization } from "./authorization";
import {
  buildOrganizationSlug,
  normalizeOrganizationName,
  randomSlugSuffix,
} from "./domain/organizationSlug";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import {
  findActiveOrganizationAccess,
  requireOrganizationPermission,
} from "./security/organizationAccess";
import { requireVerifiedPrincipal } from "./security/principal";

const organizationSummary = v.object({
  id: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
});

const organizationSummaryWithLogo = organizationSummary.extend({
  logoUrl: v.union(v.null(), v.string()),
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
      displayName: principal.name,
      email: principal.email,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("billingProfiles", {
      organizationId,
      billingEmail: principal.email.trim().toLowerCase(),
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
    await recordOrganizationAuditEvent(ctx, {
      organizationId,
      eventType: "organization.created",
      actorUserId: principal.actorId,
      actorDisplayName: principal.name,
      targetType: "organization",
      targetId: String(organizationId),
      targetLabel: name,
    });

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
  returns: v.array(organizationSummaryWithLogo),
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

    return (
      await Promise.all(
        organizations
          .filter((organization) => organization !== null)
          .map(async (organization) => ({
            id: organization._id,
            name: organization.name,
            slug: organization.slug,
            logoUrl: organization.logoStorageId
              ? await ctx.storage.getUrl(organization.logoStorageId)
              : null,
          })),
      )
    ).sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(v.null(), organizationSummaryWithLogo),
  handler: async (ctx, args) => {
    const access = await findActiveOrganizationAccess(ctx, {
      slug: args.slug,
    });

    if (!access) {
      return null;
    }

    return {
      id: access.organization._id,
      name: access.organization.name,
      slug: access.organization.slug,
      logoUrl: access.organization.logoStorageId
        ? await ctx.storage.getUrl(access.organization.logoStorageId)
        : null,
    };
  },
});

export const generateLogoUploadUrl = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:update",
    );
    return await ctx.storage.generateUploadUrl();
  },
});

export const setLogo = mutation({
  args: {
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:update",
    );
    await validateExclusiveStoredImage(ctx, args.storageId, {
      kind: "organization",
      organizationId: access.organization._id,
    });
    const previousStorageId = access.organization.logoStorageId;
    const now = Date.now();
    await ctx.db.patch(access.organization._id, {
      logoStorageId: args.storageId,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "organization.logo_updated",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "organization",
      targetId: String(access.organization._id),
      targetLabel: access.organization.name,
      occurredAt: now,
    });
    if (previousStorageId && previousStorageId !== args.storageId) {
      await ctx.storage.delete(previousStorageId);
    }
    return null;
  },
});

export const removeLogo = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:update",
    );
    if (!access.organization.logoStorageId) return null;
    const previousStorageId = access.organization.logoStorageId;
    const now = Date.now();
    await ctx.db.patch(access.organization._id, {
      logoStorageId: undefined,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "organization.logo_removed",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "organization",
      targetId: String(access.organization._id),
      targetLabel: access.organization.name,
      occurredAt: now,
    });
    await ctx.storage.delete(previousStorageId);
    return null;
  },
});

export const rename = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: organizationSummary,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
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

    const now = Date.now();
    await ctx.db.patch(access.organization._id, {
      name,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "organization.renamed",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "organization",
      targetId: String(access.organization._id),
      targetLabel: name,
      previousValue: access.organization.name,
      newValue: name,
      occurredAt: now,
    });

    return {
      id: access.organization._id,
      name,
      slug: access.organization.slug,
    };
  },
});
