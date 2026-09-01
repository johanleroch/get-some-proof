import { ConvexError, v } from "convex/values";

import { env, mutation, query } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization } from "./authorization";
import { requireOrganizationPermission } from "./security/organizationAccess";

export const getOverview = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    availability: v.union(v.literal("available"), v.literal("unavailable")),
    billingContact: v.union(v.string(), v.null()),
    canManage: v.boolean(),
    effectivePlan: v.literal("free"),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    const [profile, originalOwner, canManage] = await Promise.all([
      ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .unique(),
      ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index
            .eq("organizationId", access.organization._id)
            .eq("userId", access.organization.createdByUserId),
        )
        .unique(),
      authzForOrganization(access.tenantId).can(
        ctx,
        access.principal.actorId,
        "billing:manage",
      ),
    ]);

    return {
      availability:
        env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
          ? ("available" as const)
          : ("unavailable" as const),
      billingContact: profile?.billingEmail ?? originalOwner?.email ?? null,
      canManage,
      effectivePlan: "free" as const,
    };
  },
});

export const updateContact = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
  },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError({
        code: "INVALID_BILLING_CONTACT",
        message: "Enter a valid Billing Contact email address.",
      });
    }
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .unique();
    const now = Date.now();

    if (profile) {
      await ctx.db.patch(profile._id, { billingEmail: email, updatedAt: now });
    } else {
      await ctx.db.insert("billingProfiles", {
        organizationId: access.organization._id,
        billingEmail: email,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "billing.contact_updated",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "billing",
      targetId: String(access.organization._id),
      targetLabel: access.organization.name,
      previousValue: profile ? "configured" : "not configured",
      newValue: "configured",
    });

    return { email };
  },
});
