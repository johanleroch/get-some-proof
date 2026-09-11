import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  authzForOrganization,
  type OrganizationPermission,
} from "../authorization";
import { requireVerifiedPrincipal, type Principal } from "./principal";

type DatabaseCtx = QueryCtx | MutationCtx;

export type OrganizationSelector =
  { organizationId: Id<"organizations"> } | { slug: string };

export type ActiveOrganizationAccess = {
  membership: Doc<"memberships">;
  organization: Doc<"organizations">;
  principal: Principal;
  tenantId: string;
};

export function organizationUnavailable(): never {
  throw new ConvexError({
    code: "ORGANIZATION_UNAVAILABLE",
    message: "Organization unavailable.",
  });
}

export function organizationAccessDenied(): never {
  throw new ConvexError({
    code: "ORGANIZATION_ACCESS_DENIED",
    message: "You do not have permission to perform this Organization action.",
  });
}

async function findOrganization(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
) {
  if ("organizationId" in selector) {
    return ctx.db.get(selector.organizationId);
  }

  return ctx.db
    .query("organizations")
    .withIndex("by_slug", (index) => index.eq("slug", selector.slug))
    .unique();
}

export async function findActiveOrganizationAccess(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
): Promise<ActiveOrganizationAccess | null> {
  return findOrganizationAccessForPrincipal(
    ctx,
    selector,
    await requireVerifiedPrincipal(ctx),
  );
}

async function findOrganizationAccessForPrincipal(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
  principal: Principal,
): Promise<ActiveOrganizationAccess | null> {
  if (!principal.emailVerified) return null;
  const organization = await findOrganization(ctx, selector);

  if (!organization || organization.deletionStartedAt !== undefined) {
    return null;
  }

  if (organization.accountId) {
    const account = await ctx.db.get(organization.accountId);
    if (!account || account.deletionStartedAt !== undefined) return null;
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
    membership,
    organization,
    principal,
    tenantId: String(organization._id),
  };
}

export async function requireActiveOrganizationAccess(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
): Promise<ActiveOrganizationAccess> {
  const access = await findActiveOrganizationAccess(ctx, selector);

  return access ?? organizationUnavailable();
}

export async function requireOrganizationPermission(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
  permission: OrganizationPermission,
): Promise<ActiveOrganizationAccess> {
  return requireOrganizationPermissionForPrincipal(
    ctx,
    selector,
    permission,
    await requireVerifiedPrincipal(ctx),
  );
}

/** Allows authorized cleanup to finish after deletion has closed normal writes. */
export async function requireOrganizationCleanupPermission(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
  permission: OrganizationPermission,
) {
  const principal = await requireVerifiedPrincipal(ctx);
  const organization = await ctx.db.get(organizationId);
  if (!organization) organizationUnavailable();
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_user", (index) =>
      index
        .eq("organizationId", organizationId)
        .eq("userId", principal.actorId),
    )
    .unique();
  if (!membership || membership.status !== "active") organizationAccessDenied();
  const allowed = await authzForOrganization(String(organizationId)).can(
    ctx,
    principal.actorId,
    permission,
  );
  if (!allowed) organizationAccessDenied();
}

/** Internal callers supply an identity verified for their own authentication boundary. */
export async function requireOrganizationPermissionForPrincipal(
  ctx: DatabaseCtx,
  selector: OrganizationSelector,
  permission: OrganizationPermission,
  principal: Principal,
): Promise<ActiveOrganizationAccess> {
  const access =
    (await findOrganizationAccessForPrincipal(ctx, selector, principal)) ??
    organizationUnavailable();
  const allowed = await authzForOrganization(access.tenantId).can(
    ctx,
    access.principal.actorId,
    permission,
  );

  if (!allowed) {
    organizationAccessDenied();
  }

  return access;
}
