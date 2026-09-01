import {
  Authz,
  definePermissions,
  defineRoles,
  type PermissionString,
} from "@djpanda/convex-authz";

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
  billing: {
    read: true,
    manage: true,
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
    billing: ["read"],
  },
  owner: {
    organization: ["read", "update"],
    projects: ["read", "create", "update", "archive", "delete"],
    members: ["read", "manage"],
    invitations: ["manage"],
    ownership: ["manage"],
    audit: ["read"],
    billing: ["read", "manage"],
  },
});

export type OrganizationPermission = PermissionString<typeof permissions>;
export type OrganizationRole = keyof typeof roles;

export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: "unscoped",
});

export function authzForOrganization(organizationId: string) {
  return authz.withTenant(organizationId);
}
