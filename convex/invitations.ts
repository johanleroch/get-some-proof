import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query, type ActionCtx } from "./_generated/server";
import { authzForOrganization } from "./authorization";
import {
  hashInvitationToken,
  invitationRoleValidator,
  invitationUnavailable,
  normalizeInvitationEmail,
  randomInvitationToken,
} from "./domain/invitation";
import { sendTransactionalEmail } from "./email/provider";
import { buildOrganizationInvitationEmail } from "./email/templates";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { requireVerifiedPrincipal } from "./security/principal";

const invitationSummary = v.object({
  id: v.id("invitations"),
  email: v.string(),
  role: invitationRoleValidator,
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("revoked"),
  ),
  deliveryStatus: v.union(
    v.literal("pending"),
    v.literal("sent"),
    v.literal("failed"),
  ),
  expiresAt: v.number(),
  createdAt: v.number(),
});

type InvitationDelivery = {
  invitationId: Id<"invitations">;
  email: string;
  organizationName: string;
  role: "admin" | "editor" | "viewer";
};

function summarizeInvitation(invitation: {
  _id: Id<"invitations">;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "pending" | "accepted" | "revoked";
  deliveryStatus: "pending" | "sent" | "failed";
  expiresAt: number;
  createdAt: number;
}) {
  return {
    id: invitation._id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    deliveryStatus: invitation.deliveryStatus,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

async function deliver(
  ctx: ActionCtx,
  invitation: InvitationDelivery,
  token: string,
  deliveryIdempotencyKey: string,
) {
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const message = buildOrganizationInvitationEmail({
    email: invitation.email,
    organizationName: invitation.organizationName,
    role: invitation.role,
    url: `${siteUrl}/accept-invitation?token=${encodeURIComponent(token)}`,
  });

  try {
    const receipt = await sendTransactionalEmail(message);
    await ctx.runMutation(internal.invitationRecords.recordDelivery, {
      invitationId: invitation.invitationId,
      deliveryIdempotencyKey,
      status: "sent",
      provider: receipt.provider,
      providerMessageId: receipt.providerMessageId,
    });
  } catch (error) {
    await ctx.runMutation(internal.invitationRecords.recordDelivery, {
      invitationId: invitation.invitationId,
      deliveryIdempotencyKey,
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "Delivery failed.",
    });
    throw error;
  }
}

export const create = action({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: invitationRoleValidator,
  },
  returns: v.object({ invitationId: v.id("invitations") }),
  handler: async (ctx, args): Promise<{ invitationId: Id<"invitations"> }> => {
    const principal = await requireVerifiedPrincipal(ctx);
    const token = randomInvitationToken();
    const deliveryIdempotencyKey = crypto.randomUUID();
    const invitation: InvitationDelivery = await ctx.runMutation(
      internal.invitationRecords.createRecord,
      {
        ...args,
        actorId: principal.actorId,
        tokenHash: await hashInvitationToken(token),
        deliveryIdempotencyKey,
      },
    );
    await deliver(ctx, invitation, token, deliveryIdempotencyKey);
    return { invitationId: invitation.invitationId };
  },
});

export const resend = action({
  args: {
    organizationId: v.id("organizations"),
    invitationId: v.id("invitations"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const principal = await requireVerifiedPrincipal(ctx);
    const token = randomInvitationToken();
    const deliveryIdempotencyKey = crypto.randomUUID();
    const rotated = await ctx.runMutation(
      internal.invitationRecords.rotateRecord,
      {
        ...args,
        actorId: principal.actorId,
        tokenHash: await hashInvitationToken(token),
        deliveryIdempotencyKey,
      },
    );
    await deliver(
      ctx,
      { ...rotated, invitationId: args.invitationId },
      token,
      deliveryIdempotencyKey,
    );
    return null;
  },
});

export const changeRole = action({
  args: {
    organizationId: v.id("organizations"),
    invitationId: v.id("invitations"),
    role: invitationRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const principal = await requireVerifiedPrincipal(ctx);
    const token = randomInvitationToken();
    const deliveryIdempotencyKey = crypto.randomUUID();
    const rotated = await ctx.runMutation(
      internal.invitationRecords.rotateRecord,
      {
        ...args,
        actorId: principal.actorId,
        tokenHash: await hashInvitationToken(token),
        deliveryIdempotencyKey,
      },
    );
    await deliver(
      ctx,
      { ...rotated, invitationId: args.invitationId },
      token,
      deliveryIdempotencyKey,
    );
    return null;
  },
});

export const listPending = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(invitationSummary),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "invitations:manage",
    );
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization_status", (index) =>
        index
          .eq("organizationId", access.organization._id)
          .eq("status", "pending"),
      )
      .order("desc")
      .collect();
    return invitations.map(summarizeInvitation);
  },
});

export const revoke = mutation({
  args: {
    organizationId: v.id("organizations"),
    invitationId: v.id("invitations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "invitations:manage",
    );
    const invitation = await ctx.db.get(args.invitationId);
    if (
      !invitation ||
      invitation.organizationId !== access.organization._id ||
      invitation.status !== "pending"
    ) {
      return invitationUnavailable();
    }
    const now = Date.now();
    await ctx.db.patch(invitation._id, {
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const accept = mutation({
  args: { token: v.string() },
  returns: v.object({ organizationSlug: v.string() }),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const tokenHash = await hashInvitationToken(args.token);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token_hash", (index) => index.eq("tokenHash", tokenHash))
      .unique();
    if (
      !invitation ||
      invitation.status !== "pending" ||
      invitation.expiresAt <= Date.now()
    ) {
      return invitationUnavailable();
    }
    if (normalizeInvitationEmail(principal.email) !== invitation.email) {
      throw new ConvexError({
        code: "INVITATION_EMAIL_MISMATCH",
        message:
          "Sign in with the verified email address that received this Invitation.",
      });
    }
    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization) {
      return invitationUnavailable();
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (index) =>
        index
          .eq("organizationId", organization._id)
          .eq("userId", principal.actorId),
      )
      .unique();
    const now = Date.now();
    if (membership) {
      await ctx.db.patch(membership._id, {
        status: "active",
        deactivatedAt: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("memberships", {
        organizationId: organization._id,
        userId: principal.actorId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }
    await authzForOrganization(String(organization._id)).assignRole(
      ctx,
      principal.actorId,
      invitation.role,
      undefined,
      undefined,
      invitation.invitedByUserId,
    );
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByUserId: principal.actorId,
      acceptedAt: now,
      updatedAt: now,
    });
    return { organizationSlug: organization.slug };
  },
});
