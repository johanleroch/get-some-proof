import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Owner Account", () => {
  it("counts text and Projects across only the owner's open Account spaces", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const other = await authenticatedUser(t, {
      email: "other-owner@example.test",
    });
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Fernhill",
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Northwind",
    });
    const foreign = await other.client.mutation(api.organizations.create, {
      name: "Other studio",
    });
    await t.run(async (ctx) => {
      for (const [index, organizationId] of [
        first.id,
        first.id,
        second.id,
        foreign.id,
      ].entries()) {
        await ctx.db.insert("testimonials", {
          organizationId,
          clientSubmissionId: `sidebar-${index}`,
          submissionType: "text",
          moderationStatus: "pending",
          text: "The workshop gave our team a clear next step.",
          submitterName: "Alex Morgan",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    expect(
      (await owner.client.query(api.accounts.getMine, {}))?.usage,
    ).toMatchObject({
      organizations: 2,
      textTestimonials: 3,
      videoLimit: 25,
      textTestimonialsIsLowerBound: false,
      organizationsIsLowerBound: false,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(second.id, { deletionStartedAt: Date.now() });
    });
    expect(
      (await owner.client.query(api.accounts.getMine, {}))?.usage,
    ).toMatchObject({
      organizations: 1,
      textTestimonials: 2,
    });
    expect(
      (await other.client.query(api.accounts.getMine, {}))?.usage,
    ).toMatchObject({
      organizations: 1,
      textTestimonials: 1,
    });
  });
  it("counts unfinished Free video credits across Projects after choosing a different Free Project", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Original",
    });
    const account = await owner.client.query(api.accounts.getMine, {});
    await t.run(async (ctx) => {
      for (let index = 0; index < 2; index++)
        await ctx.db.insert("videoReservations", {
          accountId: account!.id,
          organizationId: first.id,
          plan: "free",
          status: "consumed",
          freeCreditPending: true,
          clientSubmissionId: `pending-credit-${index}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        });
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Selected",
      publicSlug: "selected",
    });
    await owner.client.mutation(api.accounts.selectFreeProject, {
      projectId: second.id,
    });
    await addStripeSubscription(t, first.id, "canceled", {
      eventCreated: Math.floor(Date.now() / 1000) + 1,
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "selected",
      }),
    ).resolves.toMatchObject({ videoAvailable: false });
  });
  it("paginates all Pro Projects beyond the navigation snapshot", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Project 0",
    });
    await addStripeSubscription(t, first.id, "active");
    for (let index = 1; index < 102; index++)
      await owner.client.mutation(api.organizations.create, {
        name: `Project ${index}`,
      });
    expect(
      await owner.client.query(api.organizations.listMine, {}),
    ).toHaveLength(100);
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
      const page = await owner.client.query(api.organizations.listMinePage, {
        paginationOpts: { numItems: 50, cursor },
      });
      expect(page.page.length).toBeLessThanOrEqual(50);
      ids.push(...page.page.map((project) => project.id));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(new Set(ids).size).toBe(102);
  });
  it("keeps an older active subscription authoritative beyond checkout history pages", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Long-lived account",
    });
    await addStripeSubscription(t, project.id, "active");
    const account = await owner.client.query(api.accounts.getMine, {});
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index++)
        await ctx.db.insert("billingSubscriptionStates", {
          accountId: account!.id,
          organizationId: project.id,
          stripeSubscriptionId: `sub_canceled_${index}`,
          stripeCustomerId: `cus_${project.id}`,
          priceId: "price_pro_monthly",
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400,
          lastStripeEventCreated: Math.floor(Date.now() / 1000),
          lastStripeEventId: `evt_canceled_${index}`,
          updatedAt: Date.now(),
        });
    });
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({ effectivePlan: "premium" });
    const checkout = await owner.client.query(
      internal.billing.getCheckoutContext,
      { organizationId: project.id },
    );
    expect(
      checkout.existingSubscriptions.some(
        (subscription) => subscription.status === "active",
      ),
    ).toBe(true);
  });
  it("preserves billing and lifetime credits when the last Project is deleted", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Disposable",
    });
    await addStripeSubscription(t, project.id, "active");
    const account = await owner.client.query(api.accounts.getMine, {});
    await t.run(async (ctx) => {
      const testimonialId = await ctx.db.insert("testimonials", {
        organizationId: project.id,
        submissionType: "text",
        moderationStatus: "pending",
        submitterName: "Someone",
        submitterEmail: "someone@example.com",
        text: "Great",
        clientSubmissionId: "delete-credit",
        managementTokenHash: "a".repeat(64),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("collectionCredits", {
        accountId: account!.id,
        organizationId: project.id,
        testimonialId,
        submissionType: "text",
        consumedAt: Date.now(),
      });
    });
    const prepared = await owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        organizationId: project.id,
        brandName: "Disposable",
        irreversibleConfirmed: true,
      },
    );
    expect(prepared.subscriptionIds).toEqual([]);
    while (
      !(await t.mutation(internal.workspaceDeletionInventory.advance, {
        deletionId: prepared.deletionId,
      }))
    ) {}
    // Drive the bounded database purge without contacting external providers.
    await t.run((ctx) =>
      ctx.db.patch(prepared.deletionId, { phase: "managementItems" }),
    );
    for (let step = 0; step < 100; step += 1) {
      if (
        await t.mutation(internal.workspaceDeletion.purgeBatch, {
          deletionId: prepared.deletionId,
        })
      )
        break;
    }
    await expect(t.run((ctx) => ctx.db.get(project.id))).resolves.toBeNull();
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({
      effectivePlan: "premium",
      usage: { freeTextUsed: 1 },
    });
    await addStripeSubscription(t, project.id, "active", {
      eventCreated: Math.floor(Date.now() / 1000) + 1,
      eventId: "evt_after_project_deleted",
    });
    expect(
      await t.run((ctx) =>
        ctx.db.query("workspaceDeletionSubscriptions").collect(),
      ),
    ).toEqual([]);
    await expect(
      owner.client.query(internal.accounts.getBillingContext, {}),
    ).resolves.toMatchObject({ customerId: expect.any(String) });
    // A completed Checkout can arrive after its originating Project was removed.
    await addStripeSubscription(t, project.id, "canceled", {
      eventCreated: Math.floor(Date.now() / 1000) + 2,
    });
    await addStripeSubscription(t, project.id, "active", {
      stripeSubscriptionId: "sub_checkout_after_project_deletion",
      eventCreated: Math.floor(Date.now() / 1000) + 3,
    });
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({ effectivePlan: "premium" });
    const outsider = await authenticatedUser(t, {
      email: "outsider-billing@example.com",
    });
    await expect(
      outsider.client.query(internal.accounts.getBillingContext, {}),
    ).rejects.toThrow();
    const next = await owner.client.mutation(api.organizations.create, {
      name: "Next project",
    });
    await expect(
      owner.client.query(api.billing.getOverview, { organizationId: next.id }),
    ).resolves.toMatchObject({ effectivePlan: "premium" });
  });
  it("keeps only the chosen Project publicly available after downgrade", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Design",
      publicSlug: "harbor-design",
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Academy",
      publicSlug: "harbor-academy",
    });
    await owner.client.mutation(api.accounts.selectFreeProject, {
      projectId: second.id,
    });
    await addStripeSubscription(t, first.id, "canceled", {
      eventCreated: Math.floor(Date.now() / 1000) + 1,
      eventId: "evt_account_downgrade",
    });
    await expect(
      t.query(api.organizations.getByPublicSlug, {
        publicSlug: "harbor-design",
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "harbor-design",
      }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(internal.video.reserveCapacity, {
        publicSlug: "harbor-design",
        clientSubmissionId: "inactive-upload",
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.organizations.getByPublicSlug, {
        publicSlug: "harbor-academy",
      }),
    ).resolves.toMatchObject({ name: "Harbor Academy" });
    await expect(
      owner.client.query(api.organizations.getBySlug, { slug: first.slug }),
    ).resolves.toMatchObject({ name: "Harbor Design" });
  });
  it("permits only one Project when Free creation requests arrive together", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const results = await Promise.allSettled([
      owner.client.mutation(api.organizations.create, {
        name: "Concurrent first",
      }),
      owner.client.mutation(api.organizations.create, {
        name: "Concurrent second",
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(
      owner.client.query(api.organizations.listMine, {}),
    ).resolves.toHaveLength(1);
  });

  it("unlocks additional Projects only after the shared Account becomes Pro", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Design",
    });
    await expect(
      owner.client.mutation(api.organizations.create, {
        name: "Harbor Academy",
      }),
    ).rejects.toThrow();
    await owner.client.mutation(internal.billing.commitContactUpdate, {
      organizationId: first.id,
      email: "billing@harbor.example",
      expectedCustomerId: null,
      leaseId: null,
      transitionId: null,
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Academy",
    });
    await expect(
      owner.client.query(internal.billing.getCheckoutContext, {
        organizationId: second.id,
      }),
    ).resolves.toMatchObject({
      existingSubscriptions: [
        { status: "active", subscriptionId: `sub_${first.id}` },
      ],
    });
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: second.id,
      }),
    ).resolves.toMatchObject({
      effectivePlan: "premium",
      billingContact: "billing@harbor.example",
    });
    await expect(
      owner.client.query(api.organizations.listMine, {}),
    ).resolves.toHaveLength(2);

    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: second.id,
      }),
    ).resolves.toMatchObject({ billingContact: "billing@harbor.example" });
  });
  it("shares video reservations across Projects in the same Account", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Studio",
      publicSlug: "harbor-studio",
    });
    await addStripeSubscription(t, first.id, "active");
    await owner.client.mutation(api.organizations.create, {
      name: "Harbor Courses",
      publicSlug: "harbor-courses",
    });
    const reservations = await Promise.allSettled(
      Array.from({ length: 26 }, (_, index) =>
        t.mutation(internal.video.reserveCapacity, {
          publicSlug: index % 2 ? "harbor-studio" : "harbor-courses",
          clientSubmissionId: `reserved-${index}`,
        }),
      ),
    );
    expect(
      reservations.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(25);
    expect(
      reservations.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({
      usage: {
        freeTextUsed: 0,
        freeVideoUsed: 0,
        readyVideos: 0,
        reservedVideos: 25,
      },
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "harbor-courses",
      }),
    ).resolves.toMatchObject({ videoAvailable: false, textAvailable: true });
    await expect(
      t.mutation(internal.video.reserveCapacity, {
        publicSlug: "harbor-courses",
        clientSubmissionId: "third-video",
      }),
    ).rejects.toThrow("VIDEO_CAPACITY_REACHED");
    const other = await authenticatedUser(t, {
      email: "another-owner@example.com",
    });
    await other.client.mutation(api.organizations.create, {
      name: "Garden Workshop",
      publicSlug: "garden-workshop",
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "garden-workshop",
      }),
    ).resolves.toMatchObject({ videoAvailable: true });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("exposes the verified plan at Account level without a Project argument", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Paid Brand",
    });
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({ effectivePlan: "free" });
    await addStripeSubscription(t, project.id, "active");
    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({ effectivePlan: "premium" });
  });
  it("creates a private Account with the first Project and reads it without a Project selector", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const outsider = await authenticatedUser(t, {
      email: "other@example.com",
    });

    await owner.client.mutation(api.organizations.create, {
      name: "First Business",
    });

    await expect(
      owner.client.query(api.accounts.getMine, {}),
    ).resolves.toMatchObject({
      ownerUserId: owner.actorId,
    });
    await expect(
      outsider.client.query(api.accounts.getMine, {}),
    ).resolves.toBeNull();
  });
});
