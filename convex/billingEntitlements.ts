import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isStripeSandboxConfigured } from "./stripeConfiguration";

export const billingStateValidator = v.union(
  v.literal("unavailable"),
  v.literal("missing"),
  v.literal("active"),
  v.literal("trialing"),
  v.literal("past_due"),
  v.literal("cancellation_scheduled"),
  v.literal("unpaid"),
  v.literal("canceled"),
  v.literal("incomplete"),
  v.literal("incomplete_expired"),
  v.literal("paused"),
  v.literal("inactive"),
);

export type BillingState =
  | "unavailable"
  | "missing"
  | "active"
  | "trialing"
  | "past_due"
  | "cancellation_scheduled"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "inactive";

export type StripeSubscriptionSnapshot = {
  cancelAt?: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number;
  priceId: string;
  status: string;
  statusChangedAt?: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

export type TrustedBillingMapping = {
  expectedProPriceId?: string;
  stripeCustomerId?: string;
};

const premiumStatuses = new Set(["active", "past_due"]);
const paymentGraceSeconds = 7 * 24 * 60 * 60;
const statePriority = new Map<string, number>([
  ["active", 0],
  ["trialing", 1],
  ["past_due", 2],
  ["incomplete", 3],
  ["paused", 4],
  ["unpaid", 5],
  ["canceled", 6],
  ["incomplete_expired", 7],
]);

function opaquePriceRevision(priceId: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < priceId.length; index += 1) {
    hash ^= priceId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `price-revision-${priceId.length}-${(hash >>> 0).toString(36)}`;
}

function subscriptionGrantsPro(
  subscription: StripeSubscriptionSnapshot,
  nowSeconds: number,
) {
  return (
    (subscription.status === "active" &&
      subscription.currentPeriodEnd > nowSeconds) ||
    (subscription.status === "past_due" &&
      subscription.statusChangedAt !== undefined &&
      nowSeconds < subscription.statusChangedAt + paymentGraceSeconds)
  );
}

function normalizedState(
  subscription: StripeSubscriptionSnapshot,
  grantsPro: boolean,
): BillingState {
  if (premiumStatuses.has(subscription.status) && !grantsPro) {
    return "inactive";
  }
  if (
    subscription.cancelAtPeriodEnd &&
    premiumStatuses.has(subscription.status)
  ) {
    return "cancellation_scheduled";
  }
  if (statePriority.has(subscription.status)) {
    return subscription.status as Exclude<
      BillingState,
      "unavailable" | "missing" | "cancellation_scheduled" | "inactive"
    >;
  }
  return "inactive";
}

export function deriveBillingEntitlement(
  subscriptions: StripeSubscriptionSnapshot[],
  configured: boolean,
  mapping: TrustedBillingMapping = {},
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  if (!configured) {
    return {
      effectivePlan: "free" as const,
      state: "unavailable" as const,
      subscription: null,
    };
  }
  if (subscriptions.length === 0) {
    return {
      effectivePlan: "free" as const,
      state: "missing" as const,
      subscription: null,
    };
  }

  const trustedSubscriptions = subscriptions.filter(
    (subscription) =>
      mapping.stripeCustomerId === subscription.stripeCustomerId &&
      mapping.expectedProPriceId === subscription.priceId,
  );
  if (trustedSubscriptions.length === 0) {
    return {
      effectivePlan: "free" as const,
      state: "inactive" as const,
      subscription: null,
    };
  }

  const selected = [...trustedSubscriptions].sort((left, right) => {
    const accessPriority =
      Number(subscriptionGrantsPro(right, nowSeconds)) -
      Number(subscriptionGrantsPro(left, nowSeconds));
    const cancellationPriority =
      Number(left.cancelAtPeriodEnd) - Number(right.cancelAtPeriodEnd);
    return (
      accessPriority ||
      (statePriority.get(left.status) ?? 100) -
        (statePriority.get(right.status) ?? 100) ||
      cancellationPriority ||
      right.currentPeriodEnd - left.currentPeriodEnd ||
      left.stripeSubscriptionId.localeCompare(right.stripeSubscriptionId)
    );
  })[0]!;
  const subscription: StripeSubscriptionSnapshot = {
    cancelAt: selected.cancelAt,
    cancelAtPeriodEnd: selected.cancelAtPeriodEnd,
    currentPeriodEnd: selected.currentPeriodEnd,
    priceId: selected.priceId,
    status: selected.status,
    statusChangedAt: selected.statusChangedAt,
    stripeCustomerId: selected.stripeCustomerId,
    stripeSubscriptionId: selected.stripeSubscriptionId,
  };
  const grantsPro = subscriptionGrantsPro(subscription, nowSeconds);
  const state = normalizedState(subscription, grantsPro);

  return {
    effectivePlan: grantsPro ? ("premium" as const) : ("free" as const),
    state,
    subscription: {
      ...subscription,
      priceRevision: opaquePriceRevision(subscription.priceId),
    },
  };
}

export async function getOrganizationBillingEntitlement(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const [subscriptions, profile] = await Promise.all([
    ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organizationId),
      )
      .unique(),
  ]);
  return deriveBillingEntitlement(
    subscriptions,
    isStripeSandboxConfigured({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    }),
    {
      expectedProPriceId: profile?.expectedProPriceId,
      stripeCustomerId: profile?.stripeCustomerId,
    },
  );
}

export async function requireProEntitlement(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  if (entitlement.effectivePlan !== "premium") {
    throw new ConvexError({
      code: "PREMIUM_REQUIRED",
      message: "Pro is required for Project changes.",
    });
  }
  return entitlement;
}
