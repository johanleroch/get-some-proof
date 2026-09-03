import authzTest from "@djpanda/convex-authz/test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";

import { components } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
  authzForOrganization,
  type OrganizationRole,
} from "../convex/authorization";
import schema from "../convex/schema";
import stripeTestSchema from "./stripe-test-component/schema";

const modules = import.meta.glob("../convex/**/*.*s");
const stripeTestModules = import.meta.glob("./stripe-test-component/**/*.*s");

export function createConvexTest() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  authzTest.register(t);
  t.registerComponent("stripe", stripeTestSchema, stripeTestModules);
  return t;
}

export async function addStripeSubscription(
  t: ReturnType<typeof convexTest>,
  organizationId: string,
  status: string,
  {
    cancelAtPeriodEnd = false,
    currentPeriodEnd = Math.floor(Date.now() / 1_000) + 2_592_000,
    lookupKey = "premium_monthly",
    stripeSubscriptionId = `sub_${organizationId}`,
  }: {
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number;
    lookupKey?: "premium_monthly" | "premium_annual";
    stripeSubscriptionId?: string;
  } = {},
) {
  await t.mutation(components.stripe.private.handleSubscriptionCreated, {
    cancelAtPeriodEnd,
    currentPeriodEnd,
    metadata: { lookupKey, orgId: organizationId },
    priceId:
      lookupKey === "premium_monthly"
        ? "price_premium_monthly"
        : "price_premium_annual",
    quantity: 1,
    status,
    stripeCustomerId: `cus_${organizationId}`,
    stripeSubscriptionId,
  });
}

export async function authenticatedUser(
  t: ReturnType<typeof convexTest>,
  {
    email = "alice@example.com",
    emailVerified = true,
    name = "Alice Owner",
  }: { email?: string; emailVerified?: boolean; name?: string } = {},
) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email,
        emailVerified,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: String(user._id),
        token: `test-session-token-${email}`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return {
    actorId: String(user._id),
    client: t.withIdentity({
      subject: String(user._id),
      sessionId: String(session._id),
      tokenIdentifier: `test|${String(user._id)}`,
      email,
      emailVerified,
      name,
    }),
  };
}

export async function addMemberWithRole(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  actorId: string,
  role: OrganizationRole,
  status: "active" | "inactive" = "active",
  profile?: { displayName: string; email: string },
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("memberships", {
      organizationId,
      userId: actorId,
      displayName: profile?.displayName,
      email: profile?.email,
      status,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: status === "inactive" ? now : undefined,
    });
    await authzForOrganization(organizationId).assignRole(
      ctx,
      actorId,
      role,
      undefined,
      undefined,
      actorId,
    );
  });
}
