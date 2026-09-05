import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("Stripe webhook synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setup() {
    const t = convexTest(schema, modules);
    const organizationId = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        collectionFormDescription: "Share your experience.",
        collectionFormTitle: "Share your story",
        createdAt: Date.now(),
        createdByUserId: "owner_1",
        name: "Acme",
        primaryColor: "#6d5dfc",
        privacyContact: "privacy@example.invalid",
        publicSlug: "acme",
        slug: "acme",
        updatedAt: Date.now(),
      }),
    );
    return { organizationId, t };
  }

  function subscriptionEvent(
    organizationId: string,
    overrides: Partial<{
      eventCreated: number;
      eventId: string;
      eventType: string;
      status: string;
    }> = {},
  ) {
    return {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      eventCreated: 200,
      eventId: "evt_current",
      eventType: "customer.subscription.updated",
      organizationId,
      priceId: "price_pro_monthly",
      status: "active",
      stripeCustomerId: "cus_acme",
      stripeSubscriptionId: "sub_acme",
      ...overrides,
    };
  }

  it("deduplicates a Stripe event before changing subscription state", async () => {
    const { organizationId, t } = await setup();
    const event = subscriptionEvent(organizationId);

    await expect(
      t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, event),
    ).resolves.toEqual({ outcome: "applied" });
    await expect(
      t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
        ...event,
        status: "canceled",
      }),
    ).resolves.toEqual({ outcome: "duplicate" });

    const { events, subscription } = await t.run(async (ctx) => ({
      events: await ctx.db.query("stripeWebhookEvents").collect(),
      subscription: await ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", "sub_acme"),
        )
        .unique(),
    }));
    expect(events).toHaveLength(1);
    expect(subscription?.status).toBe("active");
  });

  it("records but does not apply an older out-of-order event", async () => {
    const { organizationId, t } = await setup();

    await expect(
      t.mutation(
        internal.stripeWebhookSync.applySubscriptionEvent,
        subscriptionEvent(organizationId),
      ),
    ).resolves.toEqual({ outcome: "applied" });
    await expect(
      t.mutation(
        internal.stripeWebhookSync.applySubscriptionEvent,
        subscriptionEvent(organizationId, {
          eventCreated: 100,
          eventId: "evt_older",
          status: "canceled",
        }),
      ),
    ).resolves.toEqual({ outcome: "stale" });

    const { events, subscription } = await t.run(async (ctx) => ({
      events: await ctx.db.query("stripeWebhookEvents").collect(),
      subscription: await ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", "sub_acme"),
        )
        .unique(),
    }));
    expect(events.map(({ outcome }) => outcome)).toEqual(["applied", "stale"]);
    expect(subscription?.lastStripeEventId).toBe("evt_current");
    expect(subscription?.status).toBe("active");
  });
});
