import * as videoProvider from "@convex/videoProvider";
import { buildPublicationConsent } from "@convex/domain/submission";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
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
  it("retains excess video across every Project while keeping only the selected Project public", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Design",
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Harbor Academy",
    });
    await owner.client.mutation(api.accounts.selectFreeProject, {
      projectId: second.id,
    });
    const firstVideo = await createPublishedProof(t, first.id, "video", 10);
    const keep = await createPublishedProof(t, second.id, "video", 1);
    await createPublishedProof(t, second.id, "video", 2);
    const excess = await createPublishedProof(t, second.id, "video", 3);
    await addStripeSubscription(t, first.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
      eventId: "evt_account_terminal",
    });
    let transition = await latestTransition(t, first.id);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    for (let batch = 0; batch < 20; batch += 1) {
      transition = await latestTransition(t, first.id);
      if (transition!.status === "applied") break;
      await t.mutation(internal.billingDowngrade.processTransitionBatch, {
        transitionId: transition!._id,
        version: transition!.version,
        cursor: transition!.processingCursor ?? null,
      });
    }
    expect((await latestTransition(t, first.id))?.status).toBe("applied");
    const result = await t.run(async (ctx) => ({
      retentions: await ctx.db
        .query("videoDowngradeRetentions")
        .withIndex("by_transition", (q) =>
          q.eq("transitionId", transition!._id),
        )
        .collect(),
      first: await ctx.db.get(firstVideo),
      keep: await ctx.db.get(keep),
    }));
    expect(result.retentions.map((row) => row.testimonialId).sort()).toEqual(
      [firstVideo, excess].sort(),
    );
    expect(result.first?.moderationStatus).toBe("archived");
    expect(result.keep?.moderationStatus).toBe("published");
    await addStripeSubscription(t, first.id, "active", {
      eventCreated: baseNow / 1000 + 2,
      eventId: "evt_account_recovered",
      stripeSubscriptionId: "sub_new_account_subscription",
    });
    const account = await owner.client.query(api.accounts.getMine, {});
    await t.mutation(internal.billingDowngrade.recoverAccountTransitions, {
      accountId: account!.id,
      recoveredAt: Date.now(),
      currentSubscriptionId: "sub_new_account_subscription",
      cursor: null,
    });
    const recovered = await latestTransition(t, first.id);
    await t.mutation(internal.billingDowngrade.cancelRecoveredRetentions, {
      transitionId: recovered!._id,
      version: recovered!.version,
    });
    const afterRecovery = await t.run(async (ctx) => ({
      retentions: await ctx.db
        .query("videoDowngradeRetentions")
        .withIndex("by_transition", (q) => q.eq("transitionId", recovered!._id))
        .collect(),
      first: await ctx.db.get(firstVideo),
    }));
    expect(afterRecovery.retentions).toHaveLength(0);
    expect(afterRecovery.first?.moderationStatus).toBe("archived");
  });
  it("applies downgrade across surviving Projects after deleting the billing anchor", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const first = await owner.client.mutation(api.organizations.create, {
      name: "Billing anchor",
    });
    await addStripeSubscription(t, first.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Surviving project",
    });
    const account = await owner.client.query(api.accounts.getMine, {});
    await createPublishedProof(t, second.id, "video", 1);
    await createPublishedProof(t, second.id, "video", 2);
    const excess = await createPublishedProof(t, second.id, "video", 3);
    const { deletionId } = await owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        organizationId: first.id,
        brandName: "Billing anchor",
        irreversibleConfirmed: true,
      },
    );
    for (let step = 0; step < 100; step++) {
      await t.action(internal.workspaceDeletion.processDeletion, {
        deletionId,
      });
      if ((await t.run((ctx) => ctx.db.get(deletionId)))?.status === "deleted")
        break;
    }
    expect(await t.run((ctx) => ctx.db.get(first.id))).toBeNull();
    await addStripeSubscription(t, first.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
    });
    let transition = await latestTransition(t, first.id);
    expect(transition?.accountId).toBe(account!.id);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    for (let step = 0; step < 20; step++) {
      transition = await latestTransition(t, first.id);
      if (transition?.status === "applied") break;
      await t.mutation(internal.billingDowngrade.processTransitionBatch, {
        transitionId: transition!._id,
        version: transition!.version,
        cursor: transition!.processingCursor ?? null,
      });
    }
    expect(transition?.status).toBe("applied");
    const email = await t.run((ctx) =>
      ctx.db
        .query("billingLifecycleEmails")
        .withIndex("by_organization", (q) => q.eq("organizationId", first.id))
        .first(),
    );
    expect(email).not.toBeNull();
    await expect(
      t.mutation(internal.billingDowngradeEmail.reserveLifecycleEmail, {
        emailId: email!._id,
        leaseId: "surviving-account-warning",
      }),
    ).resolves.toMatchObject({ email: "alice@example.com", slug: second.slug });

    expect(
      await t.run((ctx) =>
        ctx.db
          .query("videoDowngradeRetentions")
          .withIndex("by_testimonial", (q) => q.eq("testimonialId", excess))
          .first(),
      ),
    ).not.toBeNull();
  });
  it("does not republish proof when Pro returns before downgrade batches run", async () => {
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "wall-service-test-credential-32-characters",
    );
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
    await createPublishedProof(t, first.id, "text", 1);
    const hidden = await createPublishedProof(t, second.id, "text", 2);
    const list = (publicSlug: string) =>
      t.query(api.publicWall.list, {
        secret: "wall-service-test-credential-32-characters",
        publicSlug,
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect((await list("second")).page).toHaveLength(1);
    const before = await t.query(api.publicWall.privacyRevision, {
      publicSlug: "second",
    });
    await addStripeSubscription(t, first.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
    });
    await addStripeSubscription(t, first.id, "active", {
      stripeSubscriptionId: "sub_quick_recovery",
      eventCreated: baseNow / 1000 + 2,
    });
    expect((await list("first")).page).toHaveLength(1);
    expect((await list("second")).page).toHaveLength(0);
    expect(
      await t.query(api.publicWall.privacyRevision, { publicSlug: "second" }),
    ).not.toBe(before);
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: second.id,
      testimonialId: hidden,
      status: "archived",
    });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: second.id,
      testimonialId: hidden,
      status: "published",
    });
    expect((await list("second")).page).toHaveLength(1);
  });
  it("keeps proof revoked when cancellation expires before the downgrade worker runs", async () => {
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "wall-service-test-credential-32-characters",
    );
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
    await createPublishedProof(t, first.id, "text", 1);
    const hidden = await createPublishedProof(t, second.id, "text", 2);
    const list = (publicSlug: string) =>
      t.query(api.publicWall.list, {
        secret: "wall-service-test-credential-32-characters",
        publicSlug,
        paginationOpts: { numItems: 20, cursor: null },
      });
    expect((await list("second")).page).toHaveLength(1);
    const before = await t.query(api.publicWall.privacyRevision, {
      publicSlug: "second",
    });
    await addStripeSubscription(t, first.id, "active", {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: baseNow / 1000 + 1,
      eventCreated: baseNow / 1000 + 1,
    });
    vi.setSystemTime(baseNow + 2_000);
    expect((await list("second")).page).toHaveLength(0);
    await addStripeSubscription(t, first.id, "active", {
      stripeSubscriptionId: "sub_quick_recovery",
      eventCreated: baseNow / 1000 + 3,
    });
    expect((await list("first")).page).toHaveLength(1);
    expect((await list("second")).page).toHaveLength(0);
    expect(
      await t.query(api.publicWall.privacyRevision, { publicSlug: "second" }),
    ).not.toBe(before);
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: second.id,
      testimonialId: hidden,
      status: "archived",
    });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: second.id,
      testimonialId: hidden,
      status: "published",
    });
    expect((await list("second")).page).toHaveLength(1);
  });
  it("preserves older eligible videos across repeated downgrades without a new selection", async () => {
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "wall-service-test-credential-32-characters",
    );
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Keepers",
      publicSlug: "keepers",
    });
    await addStripeSubscription(t, project.id, "active", {
      cancelAtPeriodEnd: true,
    });
    const videos = [];
    for (let index = 1; index <= 4; index++)
      videos.push(await createPublishedProof(t, project.id, "video", index));
    await owner.client.mutation(api.billingDowngrade.updateSelection, {
      organizationId: project.id,
      textIds: [],
      videoIds: videos.slice(2),
    });
    await addStripeSubscription(t, project.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
    });
    await addStripeSubscription(t, project.id, "active", {
      stripeSubscriptionId: "sub_repeat",
      eventCreated: baseNow / 1000 + 2,
    });
    await addStripeSubscription(t, project.id, "canceled", {
      stripeSubscriptionId: "sub_repeat",
      eventCreated: baseNow / 1000 + 3,
    });
    const wall = await t.query(api.publicWall.list, {
      publicSlug: "keepers",
      secret: "wall-service-test-credential-32-characters",
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(wall.page.map((item) => item.name).sort()).toEqual([
      "video 3",
      "video 4",
    ]);
  });

  it("retains an in-flight Pro video even when its testimonial arrives after downgrade processing", async () => {
    vi.stubEnv("MUX_PROVIDER", "fake");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Late upload",
      publicSlug: "late-upload",
    });
    await addStripeSubscription(t, project.id, "active");
    await createPublishedProof(t, project.id, "video", 1);
    await createPublishedProof(t, project.id, "video", 2);
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "late-pro-upload",
      fileSizeBytes: 2048,
      mimeType: "video/mp4",
      publicSlug: "late-upload",
      spokenLanguage: "en",
    });
    await addStripeSubscription(t, project.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
    });
    let transition = await latestTransition(t, project.id);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    for (let batch = 0; batch < 20; batch++) {
      transition = await latestTransition(t, project.id);
      if (transition!.status === "applied") break;
      await t.mutation(internal.billingDowngrade.processTransitionBatch, {
        transitionId: transition!._id,
        version: transition!.version,
        cursor: transition!.processingCursor ?? null,
      });
    }
    const consent = buildPublicationConsent({
      brandName: "Late upload",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Late customer" },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "late-pro-upload",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 45,
      reservationId: upload.reservationId,
      submitterEmail: "late@example.test",
      submitterName: "Late customer",
    });
    const retained = await t.run((ctx) =>
      ctx.db
        .query("videoDowngradeRetentions")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", submitted.testimonialId),
        )
        .first(),
    );
    expect(retained).toMatchObject({
      status: "retained",
      expiresAt: baseNow + 30 * DAY_MS,
    });
  });

  it("retries provider upload cleanup when the asset-created webhook was missed", async () => {
    const cancel = vi
      .spyOn(videoProvider, "cancelVideoDirectUpload")
      .mockRejectedValueOnce(new Error("Provider unavailable"))
      .mockResolvedValue(undefined);
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const project = await owner.client.mutation(api.organizations.create, {
      name: "Cleanup",
    });
    await addStripeSubscription(t, project.id, "active");
    await createPublishedProof(t, project.id, "video", 1);
    await createPublishedProof(t, project.id, "video", 2);
    const excess = await createPublishedProof(t, project.id, "video", 3);
    await t.run(async (ctx) => {
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (q) => q.eq("testimonialId", excess))
        .unique();
      await ctx.db.patch(asset!._id, {
        providerAssetId: undefined,
        status: "processing",
      });
    });
    await addStripeSubscription(t, project.id, "canceled", {
      eventCreated: baseNow / 1000 + 1,
    });
    let transition = await latestTransition(t, project.id);
    await t.mutation(internal.billingDowngrade.processTransition, {
      transitionId: transition!._id,
      version: transition!.version,
    });
    for (let batch = 0; batch < 10; batch++) {
      transition = await latestTransition(t, project.id);
      if (transition!.status === "applied") break;
      await t.mutation(internal.billingDowngrade.processTransitionBatch, {
        transitionId: transition!._id,
        version: transition!.version,
        cursor: transition!.processingCursor ?? null,
      });
    }
    const retention = await t.run((ctx) =>
      ctx.db
        .query("videoDowngradeRetentions")
        .withIndex("by_testimonial", (q) => q.eq("testimonialId", excess))
        .unique(),
    );
    vi.setSystemTime(baseNow + 30 * DAY_MS);
    await t.action(internal.billingDowngradeVideo.deleteRetainedVideo, {
      retentionId: retention!._id,
    });
    expect(cancel).toHaveBeenCalledWith("upload-3", "mux");
    expect(await t.run((ctx) => ctx.db.get(retention!._id))).toMatchObject({
      status: "retained",
    });
    await t.action(internal.billingDowngradeVideo.deleteRetainedVideo, {
      retentionId: retention!._id,
    });
    expect(await t.run((ctx) => ctx.db.get(retention!._id))).toMatchObject({
      status: "deleted",
    });
    cancel.mockRestore();
  });

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
    vi.restoreAllMocks();
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
    ).resolves.toEqual({ outcome: "processing" });
    await expect(
      t.mutation(internal.billingDowngrade.processTransitionBatch, {
        cursor: null,
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

  it("serializes video reactivation against retention deletion", async () => {
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
  });
});
