import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "@convex/_generated/api";
import { cancelStripeSubscription } from "@convex/stripeBillingProvider";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

vi.mock("@convex/stripeBillingProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@convex/stripeBillingProvider")>()),
  cancelStripeSubscription: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
  vi.stubEnv("MUX_PROVIDER", "fake");
  vi.mocked(cancelStripeSubscription).mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("Account closure", () => {
  it("requires a fresh session and explicit whole-account confirmation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, { name: "Owner" });
    await t.mutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "session",
        where: [{ field: "_id", value: owner.sessionId }],
        update: { createdAt: Date.now() - 600_000 },
      },
    });
    await expect(
      owner.client.mutation(api.accountDeletion.remove, {
        confirmation: "DELETE ACCOUNT",
        irreversibleConfirmed: true,
      }),
    ).rejects.toMatchObject({ data: { code: "SESSION_NOT_FRESH" } });
    await expect(
      owner.client.query(api.accountDeletion.getMine, {}),
    ).resolves.toBeNull();
  });

  it("blocks all projects immediately, retries cancellation, cleans up and rejects late reactivation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "First",
      publicSlug: "first",
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Second",
      publicSlug: "second",
    });
    const other = await authenticatedUser(t, { email: "other@example.com" });
    const otherProject = await other.client.mutation(api.organizations.create, {
      name: "Other",
      publicSlug: "other",
    });
    const account = await owner.client.query(api.accounts.getMine, {});
    const deletionId = await owner.client.mutation(api.accountDeletion.remove, {
      confirmation: "DELETE ACCOUNT",
      irreversibleConfirmed: true,
    });
    expect(
      await owner.client.mutation(api.accountDeletion.remove, {
        confirmation: "DELETE ACCOUNT",
        irreversibleConfirmed: true,
      }),
    ).toBe(deletionId);
    for (const project of [first, second]) {
      await expect(
        t.query(api.organizations.getByPublicSlug, {
          publicSlug: project.publicSlug,
        }),
      ).resolves.toBeNull();
      await expect(
        owner.client.query(api.organizations.getBySlug, { slug: project.slug }),
      ).resolves.toBeNull();
    }
    await expect(
      owner.client.mutation(api.organizations.create, { name: "Recreate" }),
    ).rejects.toMatchObject({ data: { code: "ACCOUNT_DELETING" } });
    await expect(
      other.client.query(api.accountDeletion.getMine, {}),
    ).resolves.toBeNull();
    vi.mocked(cancelStripeSubscription).mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );
    await t.action(internal.accountDeletion.processDeletion, { deletionId });
    await expect(
      owner.client.query(api.accountDeletion.getMine, {}),
    ).resolves.toMatchObject({ status: "failed" });
    expect(await t.run((ctx) => ctx.db.get(first.id))).not.toBeNull();
    for (let step = 0; step < 150; step++) {
      await t.action(internal.accountDeletion.processDeletion, { deletionId });
      if (
        (await owner.client.query(api.accountDeletion.getMine, {}))?.status ===
        "deleted"
      )
        break;
    }
    await expect(
      owner.client.query(api.accountDeletion.getMine, {}),
    ).resolves.toEqual({ status: "deleted" });
    expect(vi.mocked(cancelStripeSubscription).mock.calls[0]).toEqual(
      vi.mocked(cancelStripeSubscription).mock.calls[1],
    );
    expect(await t.run((ctx) => ctx.db.get(first.id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(second.id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(otherProject.id))).not.toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("billingProfiles")
          .withIndex("by_account", (q) => q.eq("accountId", account!.id))
          .collect(),
      ),
    ).toEqual([]);
    const late = await t.mutation(
      internal.stripeWebhookSync.applySubscriptionEvent,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400,
        eventCreated: Math.floor(Date.now() / 1000) + 1,
        eventId: "evt_late_closed_account",
        eventType: "customer.subscription.updated",
        organizationId: String(first.id),
        priceId: "price_pro_monthly",
        status: "active",
        stripeCustomerId: `cus_${first.id}`,
        stripeSubscriptionId: `sub_${first.id}`,
      },
    );
    expect(late).toMatchObject({ outcome: "ignored" });
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({ effectivePlan: "free" });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("billingSubscriptionStates")
          .withIndex("by_account", (q) => q.eq("accountId", account!.id))
          .collect(),
      ),
    ).toEqual([]);
  });
});
