import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Stripe webhook subscription projection", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_webhook_projection");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_webhook_projection");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("debounces signed events into an idempotent latest generation", async () => {
    vi.useFakeTimers();
    try {
      const t = createConvexTest();
      const first = await t.mutation(
        internal.stripeWebhookSync.enqueueSubscriptionEvent,
        {
          eventCreated: 100,
          eventId: "evt_queue_first",
          eventType: "customer.subscription.updated",
          stripeSubscriptionId: "sub_queue",
        },
      );
      const second = await t.mutation(
        internal.stripeWebhookSync.enqueueSubscriptionEvent,
        {
          eventCreated: 200,
          eventId: "evt_queue_second",
          eventType: "invoice.payment_failed",
          paymentFailureInvoiceId: "in_current",
          paymentFailedAt: 200,
          stripeSubscriptionId: "sub_queue",
        },
      );
      const replay = await t.mutation(
        internal.stripeWebhookSync.enqueueSubscriptionEvent,
        {
          eventCreated: 200,
          eventId: "evt_queue_second",
          eventType: "invoice.payment_failed",
          paymentFailureInvoiceId: "in_current",
          paymentFailedAt: 200,
          stripeSubscriptionId: "sub_queue",
        },
      );
      expect(first).toEqual({ generation: 1, outcome: "queued" });
      expect(second).toEqual({ generation: 2, outcome: "queued" });
      expect(replay).toEqual({ outcome: "duplicate" });
      await expect(
        t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: 1_800_000_000,
          eventCreated: 100,
          eventId: "reconcile:evt_queue_first:1",
          eventType: "stripe.subscription.reconciled",
          priceId: "price_pro_monthly",
          providerGeneration: 1,
          requiredReconciliationGeneration: 1,
          status: "active",
          stripeCustomerId: "cus_queue",
          stripeSubscriptionId: "sub_queue",
        }),
      ).resolves.toEqual({ outcome: "stale" });
      await expect(
        t.mutation(internal.stripeWebhookSync.dispatchReconciliation, {
          attempt: 0,
          generation: 2,
          stripeSubscriptionId: "sub_queue",
        }),
      ).resolves.toEqual({ dispatched: true });
      await t.mutation(internal.stripeWebhookSync.recordReconciliationFailure, {
        error: "temporary Stripe outage",
        generation: 2,
        stripeSubscriptionId: "sub_queue",
      });
      await expect(
        t.query(internal.stripeWebhookSync.readReconciliationRequest, {
          stripeSubscriptionId: "sub_queue",
        }),
      ).resolves.toMatchObject({
        generation: 2,
        latestEventCreated: 200,
        latestEventId: "evt_queue_second",
        lastError: "temporary Stripe outage",
      });
      await expect(
        t.query(internal.stripeWebhookSync.readInvoicePaymentFailure, {
          stripeInvoiceId: "in_current",
        }),
      ).resolves.toMatchObject({
        firstFailedAt: 200,
        stripeSubscriptionId: "sub_queue",
      });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("keeps first failures per Invoice when an old Invoice retries later", async () => {
    vi.useFakeTimers();
    try {
      const t = createConvexTest();
      for (const event of [
        {
          created: 200,
          eventId: "evt_current_invoice",
          invoiceId: "in_current",
        },
        { created: 150, eventId: "evt_old_invoice_first", invoiceId: "in_old" },
        { created: 500, eventId: "evt_old_invoice_retry", invoiceId: "in_old" },
      ]) {
        await t.mutation(internal.stripeWebhookSync.enqueueSubscriptionEvent, {
          eventCreated: event.created,
          eventId: event.eventId,
          eventType: "invoice.payment_failed",
          paymentFailureInvoiceId: event.invoiceId,
          paymentFailedAt: event.created,
          stripeSubscriptionId: "sub_invoice_order",
        });
      }
      await expect(
        t.query(internal.stripeWebhookSync.readInvoicePaymentFailure, {
          stripeInvoiceId: "in_current",
        }),
      ).resolves.toMatchObject({
        firstFailedAt: 200,
        lastFailureEventCreated: 200,
      });
      await expect(
        t.query(internal.stripeWebhookSync.readInvoicePaymentFailure, {
          stripeInvoiceId: "in_old",
        }),
      ).resolves.toMatchObject({
        firstFailedAt: 150,
        lastFailureEventCreated: 500,
      });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("applies each event once and ignores an older delivery", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Ordered Webhook Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: 100,
      eventId: "evt_initial",
      stripeSubscriptionId: subscriptionId,
    });
    const canceled = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 200,
        eventId: "evt_canceled",
        eventType: "customer.subscription.deleted",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "canceled",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );
    const stale = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 150,
        eventId: "evt_late_active",
        eventType: "customer.subscription.updated",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "active",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );
    const replay = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 200,
        eventId: "evt_canceled",
        eventType: "customer.subscription.deleted",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "canceled",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );

    expect(canceled.outcome).toBe("applied");
    expect(stale.outcome).toBe("stale");
    expect(replay.outcome).toBe("duplicate");
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ effectivePlan: "free", state: "canceled" });
    const eventCount = await t.run((ctx) =>
      ctx.db.query("stripeWebhookEvents").collect(),
    );
    expect(eventCount).toHaveLength(3);
  });

  it("never moves a Subscription projection across Workspaces", async () => {
    const t = createConvexTest();
    const firstOwner = await authenticatedUser(t);
    const first = await firstOwner.client.mutation(api.organizations.create, {
      name: "First Webhook Brand",
    });
    const secondOwner = await authenticatedUser(t, {
      email: "second-webhook-owner@example.com",
    });
    const second = await secondOwner.client.mutation(api.organizations.create, {
      name: "Second Webhook Brand",
    });
    const subscriptionId = `sub_${first.id}`;
    await addStripeSubscription(t, first.id, "active", {
      eventCreated: 100,
      eventId: "evt_first_workspace",
      stripeSubscriptionId: subscriptionId,
    });
    const result = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 200,
        eventId: "evt_cross_workspace",
        eventType: "customer.subscription.updated",
        organizationId: String(second.id),
        priceId: "price_pro_monthly",
        status: "active",
        stripeCustomerId: `cus_${first.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );
    expect(result.outcome).toBe("ignored");
    await expect(
      secondOwner.client.query(api.billing.getOverview, {
        organizationId: second.id,
      }),
    ).resolves.toMatchObject({ effectivePlan: "free", state: "missing" });
  });

  it("never lets a migration snapshot outrank signed provider state", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Migration Priority Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "canceled", {
      eventCreated: 200,
      eventId: "evt_provider_canceled",
      stripeSubscriptionId: subscriptionId,
    });

    const migration = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 0,
        eventId: `migration:${subscriptionId}:active:price_pro_monthly`,
        eventType: "migration.subscription.snapshot",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "active",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );

    expect(migration.outcome).toBe("stale");
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ effectivePlan: "free", state: "canceled" });
  });

  it("materializes entitlement expiry so reactive queries are invalidated", async () => {
    vi.useFakeTimers();
    const nowSeconds = 1_790_000_000;
    vi.setSystemTime(nowSeconds * 1_000);
    try {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: "Scheduled Expiry Brand" },
      );
      await addStripeSubscription(t, organization.id, "active", {
        currentPeriodEnd: nowSeconds + 10,
        eventCreated: nowSeconds,
      });
      await expect(
        owner.client.query(api.billing.getOverview, {
          organizationId: organization.id,
        }),
      ).resolves.toMatchObject({ effectivePlan: "premium", state: "active" });

      await t.finishAllScheduledFunctions(() => vi.runAllTimers());

      await expect(
        owner.client.query(api.billing.getOverview, {
          organizationId: organization.id,
        }),
      ).resolves.toMatchObject({ effectivePlan: "free", state: "inactive" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fills a missing transition time without rewinding a newer billing episode", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Transition Order Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: 200,
      statusChangedAt: 200,
      stripeSubscriptionId: subscriptionId,
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      eventCreated: 350,
      eventId: "evt_past_due_followup",
      eventType: "customer.subscription.updated",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "past_due",
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: subscriptionId,
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      eventCreated: 300,
      eventId: "evt_past_due_transition",
      eventType: "customer.subscription.updated",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "past_due",
      statusChangedAt: 300,
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: subscriptionId,
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      eventCreated: 100,
      eventId: "evt_previous_past_due_episode",
      eventType: "customer.subscription.updated",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "past_due",
      statusChangedAt: 100,
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: subscriptionId,
    });

    const state = await t.run(async (ctx) => ({
      projection: await ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", subscriptionId),
        )
        .unique(),
      transition: await ctx.db
        .query("billingDowngradeTransitions")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", subscriptionId),
        )
        .unique(),
    }));
    expect(state.projection?.statusChangedAt).toBe(300);
    expect(state.transition).toMatchObject({
      scheduledFor: 300_000 + 7 * 24 * 60 * 60 * 1_000,
      trigger: "payment_grace",
    });
  });

  it("converges on the more restrictive state for same-second events", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Same Second Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "canceled", {
      eventCreated: 500,
      eventId: "evt_canceled_first",
      stripeSubscriptionId: subscriptionId,
    });
    const lateActive = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 500,
        eventId: "evt_active_late_same_second",
        eventType: "customer.subscription.updated",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "active",
        statusChangedAt: 500,
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );
    expect(lateActive.outcome).toBe("stale");

    const secondSubscriptionId = `sub_second_${organization.id}`;
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: 600,
      eventId: "evt_active_first",
      stripeSubscriptionId: secondSubscriptionId,
    });
    const lateCanceled = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 600,
        eventId: "evt_canceled_late_same_second",
        eventType: "customer.subscription.deleted",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        status: "canceled",
        statusChangedAt: 600,
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: secondSubscriptionId,
      },
    );
    expect(lateCanceled.outcome).toBe("applied");

    const projections = await t.run((ctx) =>
      ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", organization.id),
        )
        .collect(),
    );
    expect(projections.map((projection) => projection.status)).toEqual([
      "canceled",
      "canceled",
    ]);
  });

  it("orders same-status provider reconciliations by durable generation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Provider Observation Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: 700,
      eventId: "evt_active_before_portal_change",
      stripeSubscriptionId: subscriptionId,
    });
    const reactivated = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: 1_900_000_000,
        eventCreated: 700,
        eventId: "evt_reactivated_snapshot",
        eventType: "customer.subscription.updated",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        providerGeneration: 2,
        status: "active",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );
    const lateCancellationSnapshot = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAt: 1_800_000_000,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: 1_800_000_000,
        eventCreated: 700,
        eventId: "evt_late_cancellation_snapshot",
        eventType: "customer.subscription.updated",
        organizationId: String(organization.id),
        priceId: "price_pro_monthly",
        providerGeneration: 1,
        status: "active",
        stripeCustomerId: `cus_${organization.id}`,
        stripeSubscriptionId: subscriptionId,
      },
    );

    expect(reactivated.outcome).toBe("applied");
    expect(lateCancellationSnapshot.outcome).toBe("stale");
    const projection = await t.run((ctx) =>
      ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", subscriptionId),
        )
        .unique(),
    );
    expect(projection).toMatchObject({
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_900_000_000,
      lastProviderGeneration: 2,
    });
  });

  it("starts a new grace when Stripe explicitly reports a later past-due transition", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Renewed Grace Brand",
    });
    const subscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "past_due", {
      eventCreated: 100,
      statusChangedAt: 100,
      stripeSubscriptionId: subscriptionId,
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      eventCreated: 500,
      eventId: "evt_new_past_due_episode",
      eventType: "customer.subscription.updated",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "past_due",
      statusChangedAt: 500,
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: subscriptionId,
    });

    const projection = await t.run((ctx) =>
      ctx.db
        .query("billingSubscriptionStates")
        .withIndex("by_stripe_subscription", (index) =>
          index.eq("stripeSubscriptionId", subscriptionId),
        )
        .unique(),
    );
    expect(projection?.statusChangedAt).toBe(500);
  });

  it("rejects missing or invalid Stripe signatures at the HTTP boundary", async () => {
    const t = createConvexTest();
    const payload = JSON.stringify({
      api_version: "2026-08-27.basil",
      created: 100,
      data: { object: {} },
      id: "evt_ping",
      livemode: false,
      object: "event",
      pending_webhooks: 1,
      request: null,
      type: "ping",
    });
    const missing = await t.fetch("/stripe/webhook", {
      body: payload,
      method: "POST",
    });
    const invalid = await t.fetch("/stripe/webhook", {
      body: payload,
      headers: { "stripe-signature": "invalid" },
      method: "POST",
    });
    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);

    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_webhook_projection",
    });
    const verified = await t.fetch("/stripe/webhook", {
      body: payload,
      headers: { "stripe-signature": signature },
      method: "POST",
    });
    expect(verified.status).toBe(200);
  });
});
