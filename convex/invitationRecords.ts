import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization } from "./authorization";
import {
  invitationLifetimeMs,
  invitationRoleValidator,
  invitationUnavailable,
  normalizeInvitationEmail,
} from "./domain/invitation";
import {
  organizationAccessDenied,
  organizationUnavailable,
} from "./security/organizationAccess";

async function requireTrustedInvitationManager(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  actorId: string,
) {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return organizationUnavailable();
  }
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_user", (index) =>
      index.eq("organizationId", organizationId).eq("userId", actorId),
    )
    .unique();
  if (!membership || membership.status !== "active") {
    return organizationUnavailable();
  }
  if (
    !(await authzForOrganization(String(organizationId)).can(
      ctx,
      actorId,
      "invitations:manage",
    ))
  ) {
    return organizationAccessDenied();
  }

  return { membership, organization };
}

export const getMagicLinkDelivery = internalQuery({
  args: {
    tokenHash: v.string(),
    email: v.string(),
    deliveryIdempotencyKey: v.string(),
    now: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      invitationId: v.id("invitations"),
      organizationName: v.string(),
      role: invitationRoleValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token_hash", (index) =>
        index.eq("tokenHash", args.tokenHash),
      )
      .unique();
    if (
      !invitation ||
      invitation.email !== normalizeInvitationEmail(args.email) ||
      invitation.deliveryIdempotencyKey !== args.deliveryIdempotencyKey ||
      invitation.status !== "pending" ||
      invitation.expiresAt <= args.now
    ) {
      return null;
    }
    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization) {
      return null;
    }
    return {
      invitationId: invitation._id,
      organizationName: organization.name,
      role: invitation.role,
    };
  },
});

export const createRecord = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    actorId: v.string(),
    email: v.string(),
    role: invitationRoleValidator,
    tokenHash: v.string(),
    deliveryIdempotencyKey: v.string(),
  },
  returns: v.object({
    invitationId: v.id("invitations"),
    email: v.string(),
    organizationName: v.string(),
    role: invitationRoleValidator,
  }),
  handler: async (ctx, args) => {
    const { membership, organization } = await requireTrustedInvitationManager(
      ctx,
      args.organizationId,
      args.actorId,
    );
    const email = normalizeInvitationEmail(args.email);
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_organization_email_status", (index) =>
        index
          .eq("organizationId", organization._id)
          .eq("email", email)
          .eq("status", "pending"),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        code: "INVITATION_ALREADY_PENDING",
        message: "A pending Invitation already exists for this email.",
      });
    }

    const now = Date.now();
    const invitationId = await ctx.db.insert("invitations", {
      organizationId: organization._id,
      email,
      role: args.role,
      tokenHash: args.tokenHash,
      expiresAt: now + invitationLifetimeMs,
      status: "pending",
      deliveryStatus: "pending",
      deliveryIdempotencyKey: args.deliveryIdempotencyKey,
      invitedByUserId: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: organization._id,
      eventType: "invitation.created",
      actorUserId: args.actorId,
      actorDisplayName: membership.displayName ?? "Unknown Member",
      targetType: "invitation",
      targetId: String(invitationId),
      targetLabel: email,
      newValue: args.role,
      occurredAt: now,
    });

    return {
      invitationId,
      email,
      organizationName: organization.name,
      role: args.role,
    };
  },
});

export const rotateRecord = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    invitationId: v.id("invitations"),
    actorId: v.string(),
    role: v.optional(invitationRoleValidator),
    tokenHash: v.string(),
    deliveryIdempotencyKey: v.string(),
  },
  returns: v.object({
    email: v.string(),
    organizationName: v.string(),
    role: invitationRoleValidator,
  }),
  handler: async (ctx, args) => {
    const { membership, organization } = await requireTrustedInvitationManager(
      ctx,
      args.organizationId,
      args.actorId,
    );
    const invitation = await ctx.db.get(args.invitationId);
    if (
      !invitation ||
      invitation.organizationId !== organization._id ||
      invitation.status !== "pending"
    ) {
      return invitationUnavailable();
    }
    const now = Date.now();
    const role = args.role ?? invitation.role;
    await ctx.db.patch(invitation._id, {
      role,
      tokenHash: args.tokenHash,
      expiresAt: now + invitationLifetimeMs,
      deliveryStatus: "pending",
      deliveryIdempotencyKey: args.deliveryIdempotencyKey,
      deliveryProvider: undefined,
      providerMessageId: undefined,
      deliveryError: undefined,
      updatedAt: now,
    });
    await recordOrganizationAuditEvent(ctx, {
      organizationId: organization._id,
      eventType: args.role ? "invitation.role_changed" : "invitation.resent",
      actorUserId: args.actorId,
      actorDisplayName: membership.displayName ?? "Unknown Member",
      targetType: "invitation",
      targetId: String(invitation._id),
      targetLabel: invitation.email,
      previousValue: args.role ? invitation.role : undefined,
      newValue: args.role ? role : undefined,
      occurredAt: now,
    });

    return {
      email: invitation.email,
      organizationName: organization.name,
      role,
    };
  },
});

export const recordDelivery = internalMutation({
  args: {
    invitationId: v.id("invitations"),
    deliveryIdempotencyKey: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (
      !invitation ||
      invitation.deliveryIdempotencyKey !== args.deliveryIdempotencyKey
    ) {
      return null;
    }
    await ctx.db.patch(invitation._id, {
      deliveryStatus: args.status,
      deliveryProvider: args.provider,
      providerMessageId: args.providerMessageId,
      deliveryError: args.error,
      updatedAt: Date.now(),
    });
    return null;
  },
});
