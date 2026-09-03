import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

const DAY_MS = 24 * 60 * 60 * 1_000;
const baseNow = 1_800_000_000_000;

async function createPublishedProof(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
  type: "text" | "video",
  index: number,
) {
  return t.run(async (ctx) => {
    const publishedAt = baseNow - index * 1_000;
    const testimonialId = await ctx.db.insert("testimonials", {
      clientSubmissionId: `${type}-${index}`,
      createdAt: publishedAt,
      managementTokenHash: `${type}-${index}`.padEnd(64, "a").slice(0, 64),
      moderationStatus: "published",
      organizationId,
      submissionType: type,
      submitterEmail: `${type}-${index}@example.invalid`,
      submitterName: `${type} ${index}`,
      text: type === "text" ? `Proof ${index}` : "",
      updatedAt: publishedAt,
    });
    await ctx.db.insert("publicationConsents", {
      acceptedAt: publishedAt,
      brandName: "Downgrade Brand",
      consentText: "Approved consent",
      consentVersion: "v1",
      identityFields: ["name"],
      organizationId,
      testimonialId,
    });
    if (type === "text") {
      await ctx.db.insert("publicTestimonialProjections", {
        name: `text ${index}`,
        organizationId,
        publicOrderKey: `T-${index}`,
        publishedAt,
        testimonialId,
        text: `Proof ${index}`,
        type,
      });
    } else {
      const reservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: `${type}-${index}`,
        createdAt: publishedAt,
        expiresAt: publishedAt + DAY_MS,
        organizationId,
        plan: "premium",
        providerUploadId: `upload-${index}`,
        status: "consumed",
        updatedAt: publishedAt,
      });
      await ctx.db.insert("videoAssets", {
        captionsStatus: "ready",
        createdAt: publishedAt,
        fileSizeBytes: 2_048,
        mimeType: "video/mp4",
        organizationId,
        playbackId: `playback-${index}`,
        provider: "mux",
        providerAssetId: `asset-${index}`,
        providerUploadId: `upload-${index}`,
        reservationId,
        spokenLanguage: "fr",
        status: "ready",
        testimonialId,
        updatedAt: publishedAt,
      });
      await ctx.db.insert("publicTestimonialProjections", {
        captionsAvailable: true,
        name: `video ${index}`,
        organizationId,
        playbackId: `playback-${index}`,
        publicOrderKey: `V-${index}`,
        publishedAt,
        testimonialId,
        type,
      });
    }
    await ctx.db.insert("collectionCredits", {
      consumedAt: publishedAt,
      organizationId,
      submissionType: type,
      testimonialId,
    });
    return testimonialId;
  });
}

async function latestTransition(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
) {
  return t.run((ctx) =>
    ctx.db
      .query("billingDowngradeTransitions")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organizationId),
      )
      .order("desc")
      .first(),
  );
}

describe("deterministic Pro downgrade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_downgrade");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_downgrade");
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps grace publication and credits, blocks storage, then applies Free limits once", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Grace Brand",
    });
    const videos = await Promise.all(
      [0, 1, 2].map((index) =>
        createPublishedProof(t, organization.id, "video", index),
      ),
    );
    await Promise.all(
      Array.from({ length: 14 }, (_, index) =>
        createPublishedProof(t, organization.id, "text", index),
      ),
    );
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: baseNow / 1_000,
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000 + 30 * 86_400,
      eventCreated: baseNow / 1_000 + 1,
      eventId: "evt_grace_started",
      eventType: "invoice.payment_failed",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "past_due",
      statusChangedAt: baseNow / 1_000,
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: `sub_${organization.id}`,
    });

    const transition = await latestTransition(t, organization.id);
    expect(transition).toMatchObject({
      scheduledFor: baseNow + 7 * DAY_MS,
      status: "scheduled",
      trigger: "payment_grace",
    });
    await expect(
      t.mutation(internal.video.reserveCapacity, {
        clientSubmissionId: "grace-blocked-video",
        publicSlug: organization.publicSlug,
      }),
    ).rejects.toMatchObject({
      data: { code: "PAYMENT_GRACE_VIDEO_BLOCKED" },
    });
    const before = await t.run((ctx) =>
      ctx.db.query("publicTestimonialProjections").collect(),
    );
    expect(before).toHaveLength(17);

    vi.setSystemTime(baseNow + 7 * DAY_MS);
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "processing" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: null,
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "applied" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "stale" });

    const state = await t.run(async (ctx) => ({
      credits: await ctx.db.query("collectionCredits").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      retentions: await ctx.db.query("videoDowngradeRetentions").collect(),
    }));
    expect(
      state.projections.filter((item) => item.type === "video"),
    ).toHaveLength(2);
    expect(
      state.projections.filter((item) => item.type === "text"),
    ).toHaveLength(13);
    expect(state.retentions).toHaveLength(1);
    expect(state.credits).toHaveLength(17);
    expect(state.retentions[0]).toMatchObject({ testimonialId: videos[2] });
    const session = await t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "session",
        data: {
          userId: owner.actorId,
          token: "downgrade-download-session",
          expiresAt: baseNow + 8 * DAY_MS,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    const reauthenticatedOwner = t.withIdentity({
      subject: owner.actorId,
      sessionId: String(session._id),
      tokenIdentifier: `test|${owner.actorId}`,
      email: "alice@example.com",
      emailVerified: true,
      name: "Alice Owner",
    });
    await expect(
      reauthenticatedOwner.mutation(internal.videoMedia.authorizeDownload, {
        organizationId: organization.id,
        testimonialId: videos[2]!,
      }),
    ).resolves.toMatchObject({ providerAssetId: "asset-2" });
  });

  it("honors valid keepers and fills a raced selection with newest eligible proof", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Selection Brand",
    });
    const videos = await Promise.all(
      [0, 1, 2, 3].map((index) =>
        createPublishedProof(t, organization.id, "video", index),
      ),
    );
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 2 * 86_400,
      eventCreated: baseNow / 1_000,
    });
    await owner.client.mutation(api.billingDowngrade.updateSelection, {
      organizationId: organization.id,
      textIds: [],
      videoIds: [videos[3]!, videos[2]!],
    });
    await t.run(async (ctx) => {
      const projection = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", videos[2]!),
        )
        .unique();
      await ctx.db.delete(projection!._id);
      await ctx.db.patch(videos[2]!, { moderationStatus: "archived" });
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + 2 * DAY_MS);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    await t.mutation(internal.billingDowngrade.processTransitionBatch, {
      cursor: null,
      transitionId: transition!._id,
      version: transition!.version,
    });
    const published = await t.run((ctx) =>
      ctx.db.query("publicTestimonialProjections").collect(),
    );
    expect(published.map((item) => item.testimonialId)).toEqual(
      expect.arrayContaining([videos[3], videos[0]]),
    );
    expect(published.map((item) => item.testimonialId)).not.toContain(
      videos[1],
    );
  });

  it("invalidates an old grace job when payment recovers at the boundary", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Recovered Brand",
    });
    await createPublishedProof(t, organization.id, "video", 0);
    await addStripeSubscription(t, organization.id, "past_due", {
      eventCreated: baseNow / 1_000,
      statusChangedAt: baseNow / 1_000,
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + 7 * DAY_MS - 1);
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000 + 30 * 86_400,
      eventCreated: baseNow / 1_000 + 7 * 86_400,
      eventId: "evt_grace_recovered",
      eventType: "customer.subscription.updated",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "active",
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: `sub_${organization.id}`,
    });
    vi.setSystemTime(baseNow + 7 * DAY_MS);
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "stale" });
    expect(await latestTransition(t, organization.id)).toMatchObject({
      status: "recovered",
    });
    expect(
      await t.run((ctx) =>
        ctx.db.query("publicTestimonialProjections").collect(),
      ),
    ).toHaveLength(1);
  });

  it("does not let an old canceled Subscription downgrade a Workspace with another active Pro Subscription", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Replacement Subscription Brand",
    });
    await createPublishedProof(t, organization.id, "video", 0);
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: baseNow / 1_000,
      stripeSubscriptionId: "sub_current_active",
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000,
      eventCreated: baseNow / 1_000 + 1,
      eventId: "evt_old_subscription_canceled",
      eventType: "customer.subscription.deleted",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "canceled",
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: "sub_old_canceled",
    });
    const transition = await latestTransition(t, organization.id);
    expect(transition).toMatchObject({ status: "scheduled" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "recovered" });
    await expect(
      owner.client.query(api.billingDowngrade.getPlan, {
        organizationId: organization.id,
      }),
    ).resolves.toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db.query("publicTestimonialProjections").collect(),
      ),
    ).toHaveLength(1);
  });

  it("lets only the authoritative terminal Subscription apply a downgrade", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Multiple Terminal Subscriptions Brand",
    });
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createPublishedProof(t, organization.id, "text", index),
      ),
    );
    await addStripeSubscription(t, organization.id, "canceled", {
      eventCreated: baseNow / 1_000,
      stripeSubscriptionId: "sub_terminal_alpha",
    });
    await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000,
      eventCreated: baseNow / 1_000 + 1,
      eventId: "evt_terminal_beta",
      eventType: "customer.subscription.deleted",
      organizationId: String(organization.id),
      priceId: "price_pro_monthly",
      status: "canceled",
      stripeCustomerId: `cus_${organization.id}`,
      stripeSubscriptionId: "sub_terminal_beta",
    });
    const transitions = await t.run((ctx) =>
      ctx.db.query("billingDowngradeTransitions").collect(),
    );
    const alpha = transitions.find(
      (item) => item.stripeSubscriptionId === "sub_terminal_alpha",
    )!;
    const beta = transitions.find(
      (item) => item.stripeSubscriptionId === "sub_terminal_beta",
    )!;
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: beta._id,
        version: beta.version,
      }),
    ).resolves.toEqual({ outcome: "recovered" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: alpha._id,
        version: alpha.version,
      }),
    ).resolves.toEqual({ outcome: "processing" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: null,
        transitionId: alpha._id,
        version: alpha.version,
      }),
    ).resolves.toEqual({ outcome: "applied" });
    await expect(
      t.run((ctx) => ctx.db.query("publicTestimonialProjections").collect()),
    ).resolves.toHaveLength(13);
  });

  it("applies an unbounded text downgrade through resumable bounded pages", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Paged Downgrade Brand",
    });
    const texts = await Promise.all(
      Array.from({ length: 70 }, (_, index) =>
        createPublishedProof(t, organization.id, "text", index),
      ),
    );
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 1,
      eventCreated: baseNow / 1_000,
    });
    await owner.client.mutation(api.billingDowngrade.updateSelection, {
      organizationId: organization.id,
      textIds: [texts[69]!],
      videoIds: [],
    });
    const firstCandidates = await owner.client.query(
      api.billingDowngrade.listCandidates,
      {
        organizationId: organization.id,
        paginationOpts: { cursor: null, numItems: 50 },
      },
    );
    const remainingCandidates = await owner.client.query(
      api.billingDowngrade.listCandidates,
      {
        organizationId: organization.id,
        paginationOpts: {
          cursor: firstCandidates.continueCursor,
          numItems: 50,
        },
      },
    );
    expect(firstCandidates.page).toHaveLength(50);
    expect(remainingCandidates.page).toHaveLength(20);
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + 1_000);
    await expect(
      t.mutation(internal.billingDowngrade.processTransition, {
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "processing" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: null,
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "processing" });
    const processing = await latestTransition(t, organization.id);
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: processing!.processingCursor!,
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "applied" });
    const state = await t.run(async (ctx) => ({
      archived: await ctx.db
        .query("testimonials")
        .withIndex("by_organization_status", (index) =>
          index
            .eq("organizationId", organization.id)
            .eq("moderationStatus", "archived"),
        )
        .collect(),
      published: await ctx.db.query("publicTestimonialProjections").collect(),
    }));
    expect(state.published).toHaveLength(13);
    expect(state.published.map((item) => item.testimonialId)).toContain(
      texts[69],
    );
    expect(state.archived).toHaveLength(57);
  });

  it("invalidates an in-progress downgrade when Pro recovers between batches", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Recovered Between Batches Brand",
    });
    await Promise.all(
      Array.from({ length: 70 }, (_, index) =>
        createPublishedProof(t, organization.id, "text", index),
      ),
    );
    const stripeSubscriptionId = `sub_${organization.id}`;
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 1,
      eventCreated: baseNow / 1_000,
      stripeSubscriptionId,
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + 1_000);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: null,
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "processing" });
    const afterFirstBatch = await latestTransition(t, organization.id);
    const publishedAfterFirstBatch = await t.run((ctx) =>
      ctx.db.query("publicTestimonialProjections").collect(),
    );

    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000 + 30 * 24 * 60 * 60,
      eventCreated: baseNow / 1_000 + 2,
      stripeSubscriptionId,
    });
    await expect(latestTransition(t, organization.id)).resolves.toMatchObject({
      status: "recovered",
      version: transition!.version + 1,
    });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: afterFirstBatch!.processingCursor!,
        transitionId: transition!._id,
        version: transition!.version,
      }),
    ).resolves.toEqual({ outcome: "stale" });
    await expect(
      t.run((ctx) => ctx.db.query("publicTestimonialProjections").collect()),
    ).resolves.toHaveLength(publishedAfterFirstBatch.length);
  });

  it("delivers D-7 and D-1 reminders once each through the test adapter", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Reminder Brand",
    });
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 8 * 86_400,
      eventCreated: baseNow / 1_000,
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + DAY_MS);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    const email = await t.run((ctx) =>
      ctx.db.query("billingLifecycleEmails").first(),
    );
    await t.action(internal.billingDowngradeEmail.deliverLifecycleEmail, {
      emailId: email!._id,
    });
    await t.action(internal.billingDowngradeEmail.deliverLifecycleEmail, {
      emailId: email!._id,
    });
    expect(await t.run((ctx) => ctx.db.get(email!._id))).toMatchObject({
      attempts: 1,
      status: "sent",
    });
    vi.setSystemTime(baseNow + 7 * DAY_MS);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    const emails = await t.run((ctx) =>
      ctx.db.query("billingLifecycleEmails").collect(),
    );
    expect(emails.map((delivery) => delivery.kind)).toEqual(
      expect.arrayContaining(["downgrade_d7", "downgrade_d1"]),
    );
    const d1 = emails.find((delivery) => delivery.kind === "downgrade_d1")!;
    await t.action(internal.billingDowngradeEmail.deliverLifecycleEmail, {
      emailId: d1._id,
    });
    await t.action(internal.billingDowngradeEmail.deliverLifecycleEmail, {
      emailId: d1._id,
    });
    expect(await t.run((ctx) => ctx.db.get(d1._id))).toMatchObject({
      attempts: 1,
      status: "sent",
    });
  });

  it("reclaims an expired email lease after a worker crash", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Reminder Lease Brand",
    });
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 8 * 86_400,
      eventCreated: baseNow / 1_000,
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + DAY_MS);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    const email = await t.run((ctx) =>
      ctx.db.query("billingLifecycleEmails").first(),
    );
    await expect(
      t.mutation(internal.billingDowngradeEmail.reserveLifecycleEmail, {
        emailId: email!._id,
        leaseId: "email-lease-first",
      }),
    ).resolves.toMatchObject({ kind: "downgrade_d7" });
    await expect(
      t.mutation(internal.billingDowngradeEmail.reserveLifecycleEmail, {
        emailId: email!._id,
        leaseId: "email-lease-concurrent",
      }),
    ).resolves.toBeNull();
    vi.setSystemTime(baseNow + DAY_MS + 5 * 60 * 1_000);
    await expect(
      t.mutation(internal.billingDowngradeEmail.reserveLifecycleEmail, {
        emailId: email!._id,
        leaseId: "email-lease-recovered",
      }),
    ).resolves.toMatchObject({ kind: "downgrade_d7" });
    expect(await t.run((ctx) => ctx.db.get(email!._id))).toMatchObject({
      attempts: 2,
      leaseId: "email-lease-recovered",
      status: "sending",
    });
  });

  it("skips a queued reminder when a continuing Pro Subscription becomes authoritative", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Continuing Subscription Brand",
    });
    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1_000 + 8 * 86_400,
      eventCreated: baseNow / 1_000,
      stripeSubscriptionId: "sub_alpha_canceling",
    });
    const transition = await latestTransition(t, organization.id);
    vi.setSystemTime(baseNow + DAY_MS);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    const email = await t.run((ctx) =>
      ctx.db.query("billingLifecycleEmails").first(),
    );
    expect(email).toMatchObject({ kind: "downgrade_d7", status: "pending" });

    await addStripeSubscription(t, organization.id, "active", {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: baseNow / 1_000 + 30 * 86_400,
      eventCreated: baseNow / 1_000 + 86_400,
      stripeSubscriptionId: "sub_zeta_continuing",
    });
    await expect(
      t.mutation(internal.billingDowngradeEmail.reserveLifecycleEmail, {
        emailId: email!._id,
        leaseId: "obsolete-reminder-lease",
      }),
    ).resolves.toBeNull();
    await expect(t.run((ctx) => ctx.db.get(email!._id))).resolves.toMatchObject(
      {
        attempts: 0,
        status: "skipped",
      },
    );
  });

  it("retries Mux deletion and makes retained media unavailable after success", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Retention Brand",
    });
    const testimonialId = await createPublishedProof(
      t,
      organization.id,
      "video",
      0,
    );
    const retentionId = await t.run(async (ctx) => {
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique();
      const transitionId = await ctx.db.insert("billingDowngradeTransitions", {
        appliedAt: baseNow,
        createdAt: baseNow,
        organizationId: organization.id,
        scheduledFor: baseNow,
        selectedTextIds: [],
        selectedVideoIds: [],
        status: "applied",
        stripeSubscriptionId: "sub_retention",
        trigger: "terminal_status",
        updatedAt: baseNow,
        version: 1,
      });
      return ctx.db.insert("videoDowngradeRetentions", {
        attempts: 0,
        createdAt: baseNow,
        expiresAt: baseNow,
        organizationId: organization.id,
        retainedAt: baseNow - 30 * DAY_MS,
        status: "retained",
        testimonialId,
        transitionId,
        updatedAt: baseNow,
        videoAssetId: asset!._id,
      });
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await t.action(internal.billingDowngradeVideo.deleteRetainedVideo, {
      retentionId,
    });
    expect(await t.run((ctx) => ctx.db.get(retentionId))).toMatchObject({
      attempts: 1,
      status: "retained",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await t.action(internal.billingDowngradeVideo.deleteRetainedVideo, {
      retentionId,
    });
    const deleted = await t.run(async (ctx) => ({
      asset: await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique(),
      retention: await ctx.db.get(retentionId),
    }));
    expect(deleted.asset).toBeNull();
    expect(deleted.retention).toMatchObject({ attempts: 2, status: "deleted" });
  });

  it("serializes video reactivation and late download attachment against retention deletion", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Retention Race Brand",
    });
    const testimonialId = await createPublishedProof(
      t,
      organization.id,
      "video",
      0,
    );
    await addStripeSubscription(t, organization.id, "active", {
      eventCreated: baseNow / 1_000,
    });
    const retentionId = await t.run(async (ctx) => {
      const [asset, projection] = await Promise.all([
        ctx.db
          .query("videoAssets")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .unique(),
        ctx.db
          .query("publicTestimonialProjections")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonialId),
          )
          .unique(),
      ]);
      await ctx.db.delete(projection!._id);
      await ctx.db.patch(testimonialId, { moderationStatus: "archived" });
      const transitionId = await ctx.db.insert("billingDowngradeTransitions", {
        appliedAt: baseNow,
        createdAt: baseNow,
        organizationId: organization.id,
        scheduledFor: baseNow,
        selectedTextIds: [],
        selectedVideoIds: [],
        status: "applied",
        stripeSubscriptionId: "sub_retention_race",
        trigger: "terminal_status",
        updatedAt: baseNow,
        version: 1,
      });
      return ctx.db.insert("videoDowngradeRetentions", {
        attempts: 0,
        createdAt: baseNow,
        expiresAt: baseNow,
        organizationId: organization.id,
        retainedAt: baseNow - 30 * DAY_MS,
        status: "retained",
        testimonialId,
        transitionId,
        updatedAt: baseNow,
        videoAssetId: asset!._id,
      });
    });
    await expect(
      t.mutation(internal.billingDowngradeVideo.reserveDeletion, {
        leaseId: "retention-delete-lease",
        retentionId,
      }),
    ).resolves.toMatchObject({ providerAssetId: "asset-0" });
    await expect(
      owner.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: organization.id,
        status: "published",
        testimonialId,
      }),
    ).rejects.toMatchObject({
      data: { code: "VIDEO_RETENTION_DELETION_IN_PROGRESS" },
    });
    await expect(
      owner.client.mutation(internal.videoMedia.attachDownloadAsset, {
        organizationId: organization.id,
        playbackId: "late-download-playback",
        provider: "mux",
        providerAssetId: "late-download-asset",
        testimonialId,
      }),
    ).resolves.toMatchObject({ accepted: false });
    const asset = await t.run((ctx) =>
      ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique(),
    );
    expect(asset?.downloadProviderAssetId).toBeUndefined();
  });
});
