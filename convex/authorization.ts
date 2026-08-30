import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";

import { components } from "./_generated/api";

export const permissions = definePermissions({
  organization: {
    read: true,
    update: true,
  },
  projects: {
    read: true,
    create: true,
    update: true,
    archive: true,
    delete: true,
  },
  members: {
    read: true,
    manage: true,
  },
  invitations: {
    manage: true,
  },
  ownership: {
    manage: true,
  },
  audit: {
    read: true,
  },
});

export const roles = defineRoles(permissions, {
  viewer: {
    organization: ["read"],
    projects: ["read"],
    members: ["read"],
  },
  editor: {
    organization: ["read"],
    projects: ["read", "create", "update", "archive"],
    members: ["read"],
  },
  admin: {
    organization: ["read", "update"],
    projects: ["read", "create", "update", "archive", "delete"],
    members: ["read", "manage"],
    invitations: ["manage"],
    audit: ["read"],
  },
  owner: {
    organization: ["read", "update"],
    projects: ["read", "create", "update", "archive", "delete"],
    members: ["read", "manage"],
    invitations: ["manage"],
    ownership: ["manage"],
    audit: ["read"],
  },
});

export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: "unscoped",
});

export function authzForOrganization(organizationId: string) {
  return authz.withTenant(organizationId);
}
