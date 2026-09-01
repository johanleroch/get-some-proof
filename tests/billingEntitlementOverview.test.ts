import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Billing overview Subscription normalization", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_overview");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_overview");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["active", "active", "premium"],
    ["trialing", "trialing", "premium"],
    ["past_due", "past_due", "premium"],
    ["unpaid", "unpaid", "free"],
    ["canceled", "canceled", "free"],
    ["incomplete_expired", "incomplete_expired", "free"],
  ] as const)(
    "exposes %s as %s with %s access",
    async (stripeStatus, state, effectivePlan) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: `${stripeStatus} Overview Company` },
      );
      await addStripeSubscription(t, organization.id, stripeStatus);

      await expect(
        owner.client.query(api.billing.getOverview, {
          organizationId: organization.id,
        }),
      ).resolves.toMatchObject({
        availability: "available",
        effectivePlan,
        state,
        subscription: { status: stripeStatus },
      });
      const overview = await owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      });
      expect(overview.subscription?.priceRevision).toMatch(/^price-revision-/);
      expect(overview.subscription?.priceRevision).not.toContain(
        "price_premium",
      );
      expect(overview.subscription).not.toHaveProperty("priceId");
      expect(overview.subscription).not.toHaveProperty("stripeSubscriptionId");
    },
  );

  it("exposes missing and cancellation-at-period-end distinctly", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const missingOrganization = await owner.client.mutation(
      api.organizations.create,
      { name: "Missing Subscription Company" },
    );
    const cancelingOrganization = await owner.client.mutation(
      api.organizations.create,
      { name: "Canceling Premium Company" },
    );
    await addStripeSubscription(t, cancelingOrganization.id, "active", {
      cancelAtPeriodEnd: true,
    });

    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: missingOrganization.id,
      }),
    ).resolves.toMatchObject({
      effectivePlan: "free",
      state: "missing",
      subscription: null,
    });
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: cancelingOrganization.id,
      }),
    ).resolves.toMatchObject({
      effectivePlan: "premium",
      state: "cancellation_scheduled",
      subscription: { cancelAtPeriodEnd: true },
    });
  });
});
