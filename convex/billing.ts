import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization } from "./authorization";
import {
  billingStateValidator,
  getOrganizationBillingEntitlement,
} from "./billingEntitlements";
import { premiumLookupKeyValidator } from "./billingService";
import { requireOrganizationPermission } from "./security/organizationAccess";

export const getOverview = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    availability: v.union(v.literal("available"), v.literal("unavailable")),
    billingContact: v.union(v.string(), v.null()),
    canManage: v.boolean(),
    effectivePlan: v.union(v.literal("free"), v.literal("premium")),
    state: billingStateValidator,
    subscription: v.union(
      v.null(),
      v.object({
        cancelAt: v.optional(v.number()),
        cancelAtPeriodEnd: v.boolean(),
        currentPeriodEnd: v.number(),
        status: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    const [profile, originalOwner, canManage, entitlement] = await Promise.all([
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
      getOrganizationBillingEntitlement(ctx, access.organization._id),
    ]);

    return {
      availability:
        entitlement.state === "unavailable"
          ? ("unavailable" as const)
          : ("available" as const),
      billingContact: profile?.billingEmail ?? originalOwner?.email ?? null,
      canManage,
      effectivePlan: entitlement.effectivePlan,
      state: entitlement.state,
      subscription: entitlement.subscription
        ? {
            cancelAt: entitlement.subscription.cancelAt,
            cancelAtPeriodEnd: entitlement.subscription.cancelAtPeriodEnd,
            currentPeriodEnd: entitlement.subscription.currentPeriodEnd,
            status: entitlement.subscription.status,
          }
        : null,
    };
  },
});

export const getProjectEntitlement = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    effectivePlan: v.union(v.literal("free"), v.literal("premium")),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:read",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );

    return { effectivePlan: entitlement.effectivePlan };
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

export const requireOfferAccess = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    return null;
  },
});

export const getCheckoutContext = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    billingEmail: v.string(),
    existingCustomerId: v.union(v.string(), v.null()),
    existingSubscriptions: v.array(
      v.object({ status: v.string(), subscriptionId: v.string() }),
    ),
    organizationId: v.id("organizations"),
    organizationName: v.string(),
    organizationSlug: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const [profile, originalOwner, subscriptions] = await Promise.all([
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
      ctx.runQuery(components.stripe.public.listSubscriptionsByOrgId, {
        orgId: String(access.organization._id),
      }),
    ]);
    const billingEmail = profile?.billingEmail ?? originalOwner?.email;
    if (!billingEmail) {
      throw new ConvexError({
        code: "BILLING_CONTACT_REQUIRED",
        message: "Configure a Billing Contact before starting Checkout.",
      });
    }

    return {
      billingEmail,
      existingCustomerId: profile?.stripeCustomerId ?? null,
      existingSubscriptions: subscriptions.map(
        ({ status, stripeSubscriptionId }) => ({
          status,
          subscriptionId: stripeSubscriptionId,
        }),
      ),
      organizationId: access.organization._id,
      organizationName: access.organization.name,
      organizationSlug: access.organization.slug,
    };
  },
});

const checkoutReservationValidator = v.object({
  leaseId: v.string(),
  lookupKey: premiumLookupKeyValidator,
  reservationId: v.string(),
  stripeCheckoutSessionId: v.union(v.string(), v.null()),
  stripeCustomerId: v.union(v.string(), v.null()),
});

export const reserveCheckout = internalMutation({
  args: {
    billingEmail: v.string(),
    lookupKey: premiumLookupKeyValidator,
    organizationId: v.id("organizations"),
    requestedReservationId: v.string(),
  },
  returns: checkoutReservationValidator,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .unique();

    const now = Date.now();
    if (profile?.checkoutReservationId && profile.checkoutLookupKey) {
      if (
        profile.checkoutLeaseId &&
        profile.checkoutLeaseExpiresAt &&
        profile.checkoutLeaseExpiresAt > now &&
        profile.checkoutLeaseId !== args.requestedReservationId
      ) {
        throw new ConvexError({
          code: "CHECKOUT_IN_PROGRESS",
          message: "Checkout is already being prepared. Try again shortly.",
        });
      }
      await ctx.db.patch(profile._id, {
        checkoutLeaseExpiresAt: now + 120_000,
        checkoutLeaseId: args.requestedReservationId,
        updatedAt: now,
      });
      return {
        leaseId: args.requestedReservationId,
        lookupKey: profile.checkoutLookupKey,
        reservationId: profile.checkoutReservationId,
        stripeCheckoutSessionId: profile.stripeCheckoutSessionId ?? null,
        stripeCustomerId: profile.stripeCustomerId ?? null,
      };
    }

    if (profile) {
      await ctx.db.patch(profile._id, {
        checkoutLeaseExpiresAt: now + 120_000,
        checkoutLeaseId: args.requestedReservationId,
        checkoutLookupKey: args.lookupKey,
        checkoutReservationId: args.requestedReservationId,
        stripeCheckoutSessionId: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("billingProfiles", {
        billingEmail: args.billingEmail,
        checkoutLeaseExpiresAt: now + 120_000,
        checkoutLeaseId: args.requestedReservationId,
        checkoutLookupKey: args.lookupKey,
        checkoutReservationId: args.requestedReservationId,
        organizationId: access.organization._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      leaseId: args.requestedReservationId,
      lookupKey: args.lookupKey,
      reservationId: args.requestedReservationId,
      stripeCheckoutSessionId: null,
      stripeCustomerId: profile?.stripeCustomerId ?? null,
    };
  },
});

export const rotateExpiredCheckout = internalMutation({
  args: {
    expectedLeaseId: v.string(),
    expectedReservationId: v.string(),
    lookupKey: premiumLookupKeyValidator,
    organizationId: v.id("organizations"),
    requestedReservationId: v.string(),
  },
  returns: checkoutReservationValidator,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .unique();
    if (
      !profile ||
      profile.checkoutReservationId !== args.expectedReservationId ||
      profile.checkoutLeaseId !== args.expectedLeaseId
    ) {
      throw new ConvexError({
        code: "CHECKOUT_RESERVATION_CHANGED",
        message: "Checkout changed while it was being refreshed. Try again.",
      });
    }

    await ctx.db.patch(profile._id, {
      checkoutLeaseExpiresAt: Date.now() + 120_000,
      checkoutLeaseId: args.requestedReservationId,
      checkoutLookupKey: args.lookupKey,
      checkoutReservationId: args.requestedReservationId,
      stripeCheckoutSessionId: undefined,
      updatedAt: Date.now(),
    });
    return {
      leaseId: args.requestedReservationId,
      lookupKey: args.lookupKey,
      reservationId: args.requestedReservationId,
      stripeCheckoutSessionId: null,
      stripeCustomerId: profile.stripeCustomerId ?? null,
    };
  },
});

export const saveCheckoutCustomer = internalMutation({
  args: {
    customerId: v.string(),
    leaseId: v.string(),
    organizationId: v.id("organizations"),
    reservationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .unique();
    if (
      !profile ||
      profile.checkoutReservationId !== args.reservationId ||
      profile.checkoutLeaseId !== args.leaseId
    ) {
      throw new ConvexError({
        code: "CHECKOUT_RESERVATION_CHANGED",
        message: "Checkout changed while the Customer was being saved.",
      });
    }
    if (
      profile.stripeCustomerId &&
      profile.stripeCustomerId !== args.customerId
    ) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message: "The Organization is already linked to another Customer.",
      });
    }
    await ctx.db.patch(profile._id, {
      stripeCustomerId: args.customerId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordCheckoutStarted = internalMutation({
  args: {
    customerId: v.string(),
    leaseId: v.string(),
    lookupKey: premiumLookupKeyValidator,
    organizationId: v.id("organizations"),
    reservationId: v.string(),
    sessionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .unique();
    const now = Date.now();

    if (
      !profile ||
      profile.checkoutReservationId !== args.reservationId ||
      profile.checkoutLeaseId !== args.leaseId
    ) {
      throw new ConvexError({
        code: "CHECKOUT_RESERVATION_CHANGED",
        message: "Checkout changed before the Session could be recorded.",
      });
    }
    if (
      profile.stripeCustomerId !== args.customerId ||
      (profile.stripeCheckoutSessionId &&
        profile.stripeCheckoutSessionId !== args.sessionId)
    ) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message:
          "The Checkout Session conflicts with the Organization mapping.",
      });
    }
    if (profile.stripeCheckoutSessionId === args.sessionId) {
      await ctx.db.patch(profile._id, {
        checkoutLeaseExpiresAt: undefined,
        checkoutLeaseId: undefined,
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.patch(profile._id, {
      checkoutLeaseExpiresAt: undefined,
      checkoutLeaseId: undefined,
      stripeCheckoutSessionId: args.sessionId,
      updatedAt: now,
    });

    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "billing.checkout_started",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "billing",
      targetId: String(access.organization._id),
      targetLabel: access.organization.name,
      previousValue: "Free",
      newValue:
        args.lookupKey === "premium_monthly"
          ? "Premium monthly"
          : "Premium annual",
    });

    return null;
  },
});
