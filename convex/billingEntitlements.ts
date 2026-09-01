import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "./_generated/server";

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
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

const premiumStatuses = new Set(["active", "trialing", "past_due"]);
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

function normalizedState(
  subscription: StripeSubscriptionSnapshot,
): BillingState {
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

  const selected = [...subscriptions].sort(
    (left, right) =>
      (statePriority.get(left.status) ?? 100) -
      (statePriority.get(right.status) ?? 100),
  )[0]!;
  const subscription: StripeSubscriptionSnapshot = {
    cancelAt: selected.cancelAt,
    cancelAtPeriodEnd: selected.cancelAtPeriodEnd,
    currentPeriodEnd: selected.currentPeriodEnd,
    priceId: selected.priceId,
    status: selected.status,
    stripeCustomerId: selected.stripeCustomerId,
    stripeSubscriptionId: selected.stripeSubscriptionId,
  };
  const state = normalizedState(subscription);
  const grantsPremium = premiumStatuses.has(subscription.status);

  return {
    effectivePlan: grantsPremium ? ("premium" as const) : ("free" as const),
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
  const subscriptions = await ctx.runQuery(
    components.stripe.public.listSubscriptionsByOrgId,
    { orgId: String(organizationId) },
  );
  return deriveBillingEntitlement(
    subscriptions,
    Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  );
}

export async function requirePremiumEntitlement(
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
      message: "Premium is required for Project changes.",
    });
  }
  return entitlement;
}
