import { v } from "convex/values";

import { query } from "./_generated/server";
import { authzForOrganization, type OrganizationRole } from "./authorization";
import { requireOrganizationPermission } from "./security/organizationAccess";

const roleOrder: OrganizationRole[] = ["owner", "admin", "editor", "viewer"];

export const overview = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    totalProjects: v.number(),
    activeProjects: v.number(),
    archivedProjects: v.number(),
    activeMembers: v.number(),
    pendingInvitations: v.union(v.null(), v.number()),
    projectStatus: v.array(
      v.object({ label: v.string(), projects: v.number() }),
    ),
    memberRoles: v.array(v.object({ label: v.string(), members: v.number() })),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:read",
    );
    const scopedAuthz = authzForOrganization(access.tenantId);
    const [projects, memberships, canManageInvitations] = await Promise.all([
      ctx.db
        .query("projects")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
      ctx.db
        .query("memberships")
        .withIndex("by_organization_status", (index) =>
          index
            .eq("organizationId", access.organization._id)
            .eq("status", "active"),
        )
        .collect(),
      scopedAuthz.can(ctx, access.principal.actorId, "invitations:manage"),
    ]);
    const roleCounts = Object.fromEntries(
      roleOrder.map((role) => [role, 0]),
    ) as Record<OrganizationRole, number>;
    await Promise.all(
      memberships.map(async (membership) => {
        const assignments = await scopedAuthz.getUserRoles(
          ctx,
          membership.userId,
        );
        const assigned = new Set(assignments.map(({ role }) => role));
        const role = roleOrder.find((candidate) => assigned.has(candidate));
        if (role) roleCounts[role] += 1;
      }),
    );
    const pendingInvitations = canManageInvitations
      ? await ctx.db
          .query("invitations")
          .withIndex("by_organization_status", (index) =>
            index
              .eq("organizationId", access.organization._id)
              .eq("status", "pending"),
          )
          .collect()
      : null;
    const activeProjects = projects.filter(
      ({ status }) => status === "active",
    ).length;
    const archivedProjects = projects.length - activeProjects;

    return {
      totalProjects: projects.length,
      activeProjects,
      archivedProjects,
      activeMembers: memberships.length,
      pendingInvitations: pendingInvitations?.length ?? null,
      projectStatus: [
        { label: "Active", projects: activeProjects },
        { label: "Archived", projects: archivedProjects },
      ],
      memberRoles: roleOrder.map((role) => ({
        label: role[0].toUpperCase() + role.slice(1),
        members: roleCounts[role],
      })),
    };
  },
});
