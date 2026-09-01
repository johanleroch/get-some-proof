import { v } from "convex/values";

import { query } from "./_generated/server";
import { authzForOrganization, type OrganizationRole } from "./authorization";
import { requireActiveOrganizationAccess } from "./security/organizationAccess";

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("editor"),
  v.literal("viewer"),
);

const rolePriority: OrganizationRole[] = ["owner", "admin", "editor", "viewer"];

export const getMine = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    role: v.union(v.null(), roleValidator),
    can: v.object({
      updateOrganization: v.boolean(),
      createProjects: v.boolean(),
      deleteProjects: v.boolean(),
      manageMembers: v.boolean(),
      manageOwnership: v.boolean(),
      readAudit: v.boolean(),
      readBilling: v.boolean(),
      manageBilling: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const access = await requireActiveOrganizationAccess(ctx, {
      organizationId: args.organizationId,
    });
    const scopedAuthz = authzForOrganization(access.tenantId);
    const [
      assignedRoles,
      updateOrganization,
      createProjects,
      deleteProjects,
      manageMembers,
      manageOwnership,
      readAudit,
      readBilling,
      manageBilling,
    ] = await Promise.all([
      scopedAuthz.getUserRoles(ctx, access.principal.actorId),
      scopedAuthz.can(ctx, access.principal.actorId, "organization:update"),
      scopedAuthz.can(ctx, access.principal.actorId, "projects:create"),
      scopedAuthz.can(ctx, access.principal.actorId, "projects:delete"),
      scopedAuthz.can(ctx, access.principal.actorId, "members:manage"),
      scopedAuthz.can(ctx, access.principal.actorId, "ownership:manage"),
      scopedAuthz.can(ctx, access.principal.actorId, "audit:read"),
      scopedAuthz.can(ctx, access.principal.actorId, "billing:read"),
      scopedAuthz.can(ctx, access.principal.actorId, "billing:manage"),
    ]);
    const assignedRoleNames = new Set(
      assignedRoles.map((assignment) => assignment.role),
    );
    const role =
      rolePriority.find((candidate) => assignedRoleNames.has(candidate)) ??
      null;

    return {
      role,
      can: {
        updateOrganization,
        createProjects,
        deleteProjects,
        manageMembers,
        manageOwnership,
        readAudit,
        readBilling,
        manageBilling,
      },
    };
  },
});
