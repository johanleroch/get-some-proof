import { ConvexError, v } from "convex/values";

import { internalMutation, internalQuery, query } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization } from "./authorization";
import {
  billingStateValidator,
  getOrganizationBillingEntitlement,
} from "./billingEntitlements";
import { proLookupKeyValidator } from "./billingService";
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
        priceRevision: v.string(),
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
            priceRevision: entitlement.subscription.priceRevision,
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

export const getManagementContext = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    customerId: v.union(v.string(), v.null()),
    organizationId: v.id("organizations"),
    organizationName: v.string(),
    organizationSlug: v.string(),
    state: billingStateValidator,
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const [profile, entitlement] = await Promise.all([
      ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .unique(),
      getOrganizationBillingEntitlement(ctx, access.organization._id),
    ]);
    const subscriptionCustomerId =
      entitlement.subscription?.stripeCustomerId ?? null;
    if (
      profile?.stripeCustomerId &&
      subscriptionCustomerId &&
      profile.stripeCustomerId !== subscriptionCustomerId
    ) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message: "The Organization Customer mapping is inconsistent.",
      });
    }

    return {
      customerId: profile?.stripeCustomerId ?? subscriptionCustomerId,
      organizationId: access.organization._id,
      organizationName: access.organization.name,
      organizationSlug: access.organization.slug,
      state: entitlement.state,
    };
  },
});

export const getSubscriptionPriceContext = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.null(), v.object({ priceId: v.string() })),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:read",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    return entitlement.subscription
      ? { priceId: entitlement.subscription.priceId }
      : null;
  },
});

const CONTACT_UPDATE_LEASE_MS = 5 * 60 * 1000;

export const reserveContactUpdate = internalMutation({
  args: {
    email: v.string(),
    organizationId: v.id("organizations"),
    requestedLeaseId: v.string(),
    requestedTransitionId: v.string(),
  },
  returns: v.object({
    customerId: v.string(),
    leaseId: v.string(),
    transitionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const [profile, entitlement] = await Promise.all([
      ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .unique(),
      getOrganizationBillingEntitlement(ctx, access.organization._id),
    ]);
    if (!profile) {
      throw new ConvexError({
        code: "BILLING_PROFILE_REQUIRED",
        message: "The Organization Billing profile is unavailable.",
      });
    }
    const subscriptionCustomerId =
      entitlement.subscription?.stripeCustomerId ?? null;
    if (
      profile.stripeCustomerId &&
      subscriptionCustomerId &&
      profile.stripeCustomerId !== subscriptionCustomerId
    ) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message: "The Organization Customer mapping is inconsistent.",
      });
    }
    const customerId = profile.stripeCustomerId ?? subscriptionCustomerId;
    if (!customerId) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_REQUIRED",
        message: "No Stripe Customer is available for synchronization.",
      });
    }
    const now = Date.now();
    const hasActiveLease =
      Boolean(profile.contactUpdateLeaseId) &&
      (profile.contactUpdateLeaseExpiresAt ?? 0) > now;
    if (profile.contactUpdateId && hasActiveLease) {
      throw new ConvexError({
        code: "CONTACT_UPDATE_IN_PROGRESS",
        message: "The Billing Contact is already being synchronized.",
      });
    }
    const transitionId =
      profile.contactUpdateId && profile.contactUpdateEmail === args.email
        ? profile.contactUpdateId
        : args.requestedTransitionId;
    await ctx.db.patch(profile._id, {
      contactUpdateEmail: args.email,
      contactUpdateId: transitionId,
      contactUpdateLeaseId: args.requestedLeaseId,
      contactUpdateLeaseExpiresAt: now + CONTACT_UPDATE_LEASE_MS,
      stripeCustomerId: customerId,
      updatedAt: now,
    });
    return { customerId, leaseId: args.requestedLeaseId, transitionId };
  },
});

export const releaseContactUpdate = internalMutation({
  args: {
    expectedCustomerId: v.string(),
    leaseId: v.string(),
    organizationId: v.id("organizations"),
    transitionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", args.organizationId),
      )
      .unique();
    if (
      profile?.contactUpdateId === args.transitionId &&
      profile.contactUpdateLeaseId === args.leaseId &&
      profile.stripeCustomerId === args.expectedCustomerId
    ) {
      await ctx.db.patch(profile._id, {
        contactUpdateLeaseExpiresAt: undefined,
        contactUpdateLeaseId: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const commitContactUpdate = internalMutation({
  args: {
    email: v.string(),
    expectedCustomerId: v.union(v.string(), v.null()),
    leaseId: v.union(v.string(), v.null()),
    organizationId: v.id("organizations"),
    transitionId: v.union(v.string(), v.null()),
  },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) {
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
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    const synchronizedCustomerId =
      entitlement.subscription?.stripeCustomerId ?? null;
    if (
      (profile?.stripeCustomerId &&
        profile.stripeCustomerId !== args.expectedCustomerId) ||
      (synchronizedCustomerId &&
        synchronizedCustomerId !== args.expectedCustomerId)
    ) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message: "The Organization Customer mapping changed.",
      });
    }
    if (
      args.expectedCustomerId &&
      (!args.leaseId ||
        !args.transitionId ||
        profile?.contactUpdateId !== args.transitionId ||
        profile.contactUpdateLeaseId !== args.leaseId ||
        profile.contactUpdateEmail !== args.email)
    ) {
      throw new ConvexError({
        code: "CONTACT_UPDATE_RESERVATION_CHANGED",
        message: "The Billing Contact update changed before it completed.",
      });
    }
    const now = Date.now();

    if (profile) {
      await ctx.db.patch(profile._id, {
        billingEmail: args.email,
        contactUpdateEmail: undefined,
        contactUpdateId: undefined,
        contactUpdateLeaseExpiresAt: undefined,
        contactUpdateLeaseId: undefined,
        stripeCustomerId: args.expectedCustomerId ?? undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("billingProfiles", {
        organizationId: access.organization._id,
        billingEmail: args.email,
        stripeCustomerId: args.expectedCustomerId ?? undefined,
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

    return { email: args.email };
  },
});

export const recordPortalOpened = internalMutation({
  args: {
    customerId: v.string(),
    mode: v.union(v.literal("manage"), v.literal("payment_method_update")),
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "billing:manage",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      access.organization._id,
    );
    if (entitlement.subscription?.stripeCustomerId !== args.customerId) {
      throw new ConvexError({
        code: "BILLING_CUSTOMER_CONFLICT",
        message: "The Organization Customer mapping changed.",
      });
    }

    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "billing.portal_opened",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "billing",
      targetId: String(access.organization._id),
      targetLabel: access.organization.name,
      newValue:
        args.mode === "payment_method_update"
          ? "Payment method update"
          : "Subscription management",
    });
    return null;
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
      ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", access.organization._id),
        )
        .collect(),
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
  expectedProPriceId: v.union(v.string(), v.null()),
  leaseId: v.string(),
  lookupKey: proLookupKeyValidator,
  reservationId: v.string(),
  stripeCheckoutSessionId: v.union(v.string(), v.null()),
  stripeCustomerId: v.union(v.string(), v.null()),
});

export const reserveCheckout = internalMutation({
  args: {
    billingEmail: v.string(),
    lookupKey: proLookupKeyValidator,
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
    if (
      profile?.checkoutReservationId &&
      profile.checkoutLookupKey === args.lookupKey
    ) {
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
        expectedProPriceId: profile.expectedProPriceId ?? null,
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
        expectedProPriceId: undefined,
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
      expectedProPriceId: null,
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
    lookupKey: proLookupKeyValidator,
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
      expectedProPriceId: undefined,
      stripeCheckoutSessionId: undefined,
      updatedAt: Date.now(),
    });
    return {
      expectedProPriceId: null,
      leaseId: args.requestedReservationId,
      lookupKey: args.lookupKey,
      reservationId: args.requestedReservationId,
      stripeCheckoutSessionId: null,
      stripeCustomerId: profile.stripeCustomerId ?? null,
    };
  },
});

export const saveCheckoutOffer = internalMutation({
  args: {
    leaseId: v.string(),
    organizationId: v.id("organizations"),
    priceId: v.string(),
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
        message: "Checkout changed while the Pro offer was being saved.",
      });
    }
    if (
      profile.expectedProPriceId &&
      profile.expectedProPriceId !== args.priceId
    ) {
      throw new ConvexError({
        code: "BILLING_PRICE_CONFLICT",
        message: "The Pro Price changed during Checkout.",
      });
    }
    await ctx.db.patch(profile._id, {
      expectedProPriceId: args.priceId,
      updatedAt: Date.now(),
    });
    return null;
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
    lookupKey: proLookupKeyValidator,
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
      !profile.expectedProPriceId ||
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
      newValue: "Pro monthly",
    });

    return null;
  },
});
