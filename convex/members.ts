import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization, type OrganizationRole } from "./authorization";
import {
  organizationAccessDenied,
  requireActiveOrganizationAccess,
  requireOrganizationPermission,
} from "./security/organizationAccess";

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("editor"),
  v.literal("viewer"),
);
const membershipSummary = v.object({
  id: v.id("memberships"),
  userId: v.string(),
  displayName: v.string(),
  email: v.string(),
  role: v.union(v.null(), roleValidator),
  status: v.union(v.literal("active"), v.literal("inactive")),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const rolePriority: OrganizationRole[] = ["owner", "admin", "editor", "viewer"];

function membershipUnavailable(): never {
  throw new ConvexError({
    code: "MEMBERSHIP_UNAVAILABLE",
    message: "Membership unavailable.",
  });
}

function lastOwnerRequired(): never {
  throw new ConvexError({
    code: "LAST_OWNER_REQUIRED",
    message: "Every Organization must retain at least one Owner.",
  });
}

async function getRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: string,
) {
  const assignments = await authzForOrganization(
    String(organizationId),
  ).getUserRoles(ctx, userId);
  const assigned = new Set(assignments.map(({ role }) => role));

  return rolePriority.find((role) => assigned.has(role)) ?? null;
}

async function summarizeMembership(
  ctx: QueryCtx | MutationCtx,
  membership: Doc<"memberships">,
) {
  return {
    id: membership._id,
    userId: membership.userId,
    displayName: membership.displayName ?? "Unknown Member",
    email: membership.email ?? "Email unavailable",
    role:
      membership.status === "active"
        ? await getRole(ctx, membership.organizationId, membership.userId)
        : null,
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

async function requireTargetMembership(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  membershipId: Id<"memberships">,
) {
  const membership = await ctx.db.get(membershipId);
  if (
    !membership ||
    membership.organizationId !== organizationId ||
    membership.status !== "active"
  ) {
    return membershipUnavailable();
  }

  return membership;
}

async function countActiveOwners(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_organization_status", (index) =>
      index.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();
  const ownerChecks = await Promise.all(
    memberships.map((membership) =>
      authzForOrganization(String(organizationId)).hasRole(
        ctx,
        membership.userId,
        "owner",
      ),
    ),
  );

  return ownerChecks.filter(Boolean).length;
}

async function requireMemberAdministration(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  targetRole: OrganizationRole | null,
  nextRole?: OrganizationRole,
) {
  const access = await requireActiveOrganizationAccess(ctx, { organizationId });
  const permission =
    targetRole === "owner" || nextRole === "owner"
      ? "ownership:manage"
      : "members:manage";
  const allowed = await authzForOrganization(access.tenantId).can(
    ctx,
    access.principal.actorId,
    permission,
  );

  if (!allowed) {
    return organizationAccessDenied();
  }

  return access;
}

export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(membershipSummary),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "members:read",
    );
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_organization_status", (index) =>
        index
          .eq("organizationId", access.organization._id)
          .eq("status", "active"),
      )
      .collect();
    const summaries = await Promise.all(
      memberships.map((membership) => summarizeMembership(ctx, membership)),
    );

    return summaries.sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  },
});

export const listHistory = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(membershipSummary),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "members:manage",
    );
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_organization_status", (index) =>
        index
          .eq("organizationId", access.organization._id)
          .eq("status", "inactive"),
      )
      .collect();

    return Promise.all(
      memberships.map((membership) => summarizeMembership(ctx, membership)),
    );
  },
});

export const changeRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipId: v.id("memberships"),
    role: roleValidator,
  },
  returns: membershipSummary,
  handler: async (ctx, args) => {
    const membership = await requireTargetMembership(
      ctx,
      args.organizationId,
      args.membershipId,
    );
    const currentRole = await getRole(
      ctx,
      args.organizationId,
      membership.userId,
    );
    const access = await requireMemberAdministration(
      ctx,
      args.organizationId,
      currentRole,
      args.role,
    );
    if (
      currentRole === "owner" &&
      args.role !== "owner" &&
      (await countActiveOwners(ctx, args.organizationId)) <= 1
    ) {
      return lastOwnerRequired();
    }
    const scopedAuthz = authzForOrganization(access.tenantId);
    await scopedAuthz.revokeAllRoles(
      ctx,
      membership.userId,
      undefined,
      access.principal.actorId,
    );
    await scopedAuthz.assignRole(
      ctx,
      membership.userId,
      args.role,
      undefined,
      undefined,
      access.principal.actorId,
    );
    const now = Date.now();
    await ctx.db.patch(membership._id, { updatedAt: now });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "membership.role_changed",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "membership",
      targetId: String(membership._id),
      targetLabel:
        membership.displayName ?? membership.email ?? "Unknown Member",
      previousValue: currentRole ?? undefined,
      newValue: args.role,
      occurredAt: now,
    });

    return summarizeMembership(ctx, {
      ...membership,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipId: v.id("memberships"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membership = await requireTargetMembership(
      ctx,
      args.organizationId,
      args.membershipId,
    );
    const targetRole = await getRole(
      ctx,
      args.organizationId,
      membership.userId,
    );
    const access = await requireMemberAdministration(
      ctx,
      args.organizationId,
      targetRole,
    );
    if (
      targetRole === "owner" &&
      (await countActiveOwners(ctx, args.organizationId)) <= 1
    ) {
      return lastOwnerRequired();
    }
    await authzForOrganization(access.tenantId).revokeAllRoles(
      ctx,
      membership.userId,
      undefined,
      access.principal.actorId,
    );
    const now = Date.now();
    await ctx.db.patch(membership._id, {
      status: "inactive",
      deactivatedAt: now,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "membership.removed",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "membership",
      targetId: String(membership._id),
      targetLabel:
        membership.displayName ?? membership.email ?? "Unknown Member",
      previousValue: targetRole ?? undefined,
      occurredAt: now,
    });
    return null;
  },
});

export const leave = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireActiveOrganizationAccess(ctx, {
      organizationId: args.organizationId,
    });
    const currentRole = await getRole(
      ctx,
      args.organizationId,
      access.principal.actorId,
    );
    if (
      currentRole === "owner" &&
      (await countActiveOwners(ctx, args.organizationId)) <= 1
    ) {
      return lastOwnerRequired();
    }
    await authzForOrganization(access.tenantId).revokeAllRoles(
      ctx,
      access.principal.actorId,
      undefined,
      access.principal.actorId,
    );
    const now = Date.now();
    await ctx.db.patch(access.membership._id, {
      status: "inactive",
      deactivatedAt: now,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "membership.left",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "membership",
      targetId: String(access.membership._id),
      targetLabel:
        access.membership.displayName ??
        access.membership.email ??
        "Unknown Member",
      previousValue: currentRole ?? undefined,
      occurredAt: now,
    });
    return null;
  },
});
