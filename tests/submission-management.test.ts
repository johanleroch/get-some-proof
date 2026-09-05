import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  buildPublicationConsent,
  deriveSubmissionManagementToken,
  hashSubmissionManagementToken,
} from "@convex/domain/submission";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

const originalToken = "a".repeat(64);

async function createManagedText(
  t: ReturnType<typeof createConvexTest>,
  options: { published?: boolean } = {},
) {
  const owner = await authenticatedUser(t);
  const brand = await owner.client.mutation(api.organizations.create, {
    name: "Acme Studio",
    publicSlug: "acme-proof",
  });
  const consent = buildPublicationConsent({
    brandName: "Acme Studio",
    privacyContact: "alice@example.com",
    suppliedIdentity: {
      avatarSupplied: false,
      company: "North Star Co",
      name: "Alice Martin",
      rating: 5,
      role: "Founder",
    },
  });
  const testimonialId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("testimonials", {
      clientSubmissionId: "managed-text-001",
      company: "North Star Co",
      contentVersion: 1,
      createdAt: now,
      managementTokenHash: await hashSubmissionManagementToken(originalToken),
      moderationStatus: options.published ? "published" : "pending",
      organizationId: brand.id,
      rating: 5,
      role: "Founder",
      submissionType: "text",
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
      text: "The original testimonial remains stable until confirmation.",
      updatedAt: now,
    });
    await ctx.db.insert("publicationConsents", {
      acceptedAt: now,
      brandName: "Acme Studio",
      consentText: consent.text,
      consentVersion: consent.version,
      identityFields: consent.identityFields,
      organizationId: brand.id,
      testimonialId: id,
    });
    if (options.published) {
      await ctx.db.insert("publicTestimonialProjections", {
        company: "North Star Co",
        name: "Alice Martin",
        organizationId: brand.id,
        publicOrderKey: "V",
        publishedAt: now,
        rating: 5,
        role: "Founder",
        testimonialId: id,
        text: "The original testimonial remains stable until confirmation.",
        type: "text",
      });
    }
    return id;
  });
  return { brand, consent, testimonialId };
}

function revisedConsent() {
  return buildPublicationConsent({
    brandName: "Acme Studio",
    privacyContact: "alice@example.com",
    suppliedIdentity: {
      avatarSupplied: false,
      company: "North Star Labs",
      name: "Alice Martin",
      rating: 4,
      role: "CEO",
    },
  });
}

function revisionArgs(consent = revisedConsent()) {
  return {
    company: "North Star Labs",
    consentAccepted: true,
    consentText: consent.text,
    consentVersion: consent.version,
    expectedContentVersion: 1,
    rating: 4,
    role: "CEO",
    submitterName: "Alice Martin",
    text: "The revised testimonial is specific, genuine, and ready for review.",
    token: originalToken,
  };
}

async function createManagedVideo(t: ReturnType<typeof createConvexTest>) {
  const owner = await authenticatedUser(t);
  const brand = await owner.client.mutation(api.organizations.create, {
    name: "Acme Studio",
    publicSlug: "acme-proof",
  });
  const consent = buildPublicationConsent({
    brandName: "Acme Studio",
    privacyContact: "alice@example.com",
    suppliedIdentity: {
      avatarSupplied: false,
      company: "North Star Co",
      name: "Alice Martin",
      rating: 5,
      role: "Founder",
    },
  });
  const stored = await t.run(async (ctx) => {
    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      clientSubmissionId: "managed-video-001",
      company: "North Star Co",
      contentVersion: 1,
      createdAt: now,
      managementTokenHash: await hashSubmissionManagementToken(originalToken),
      moderationStatus: "published",
      organizationId: brand.id,
      rating: 5,
      role: "Founder",
      submissionType: "video",
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
      text: "",
      updatedAt: now,
    });
    const reservationId = await ctx.db.insert("videoReservations", {
      clientSubmissionId: "managed-video-001",
      createdAt: now,
      expiresAt: now + 60_000,
      organizationId: brand.id,
      plan: "premium",
      status: "consumed",
      updatedAt: now,
    });
    const videoAssetId = await ctx.db.insert("videoAssets", {
      captionsStatus: "ready",
      createdAt: now,
      durationSeconds: 30,
      fileSizeBytes: 1_000,
      mimeType: "video/mp4",
      organizationId: brand.id,
      playbackId: "old-playback",
      provider: "fake",
      providerAssetId: "old-provider-asset",
      providerUploadId: "old-provider-upload",
      reservationId,
      spokenLanguage: "en",
      status: "ready",
      testimonialId,
      updatedAt: now,
    });
    await ctx.db.insert("publicationConsents", {
      acceptedAt: now,
      brandName: "Acme Studio",
      consentText: consent.text,
      consentVersion: consent.version,
      identityFields: consent.identityFields,
      organizationId: brand.id,
      testimonialId,
    });
    await ctx.db.insert("publicTestimonialProjections", {
      captionsAvailable: true,
      company: "North Star Co",
      name: "Alice Martin",
      organizationId: brand.id,
      playbackId: "old-playback",
      posterTimeSeconds: 15,
      publicOrderKey: "V",
      publishedAt: now,
      rating: 5,
      role: "Founder",
      testimonialId,
      type: "video",
    });
    return { testimonialId, videoAssetId };
  });
  return { brand, owner, ...stored };
}

describe("Submission Management Links", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MANAGEMENT_LINK_TOKEN_SECRET", "m".repeat(64));
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_submission_management");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_submission_management");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("exposes only the Submission selected by a valid, unexpired token", async () => {
    const t = createConvexTest();
    const { testimonialId } = await createManagedText(t);

    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toMatchObject({
      contentVersion: 1,
      submissionType: "text",
      submitterEmail: "alice@example.com",
    });
    await expect(
      t.query(api.submissionManagement.get, { token: "b".repeat(64) }),
    ).resolves.toBeNull();

    await t.run((ctx) =>
      ctx.db.patch(testimonialId, { managementTokenExpiresAt: Date.now() - 1 }),
    );
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toBeNull();
  });

  it("atomically confirms a text revision, unpublishes it, and preserves identity and email", async () => {
    const t = createConvexTest();
    const { testimonialId } = await createManagedText(t, { published: true });

    await expect(
      t.mutation(api.submissionManagement.confirmRevision, revisionArgs()),
    ).resolves.toEqual({ contentVersion: 2, moderationStatus: "pending" });

    const stored = await t.run(async (ctx) => ({
      consent: await ctx.db.query("publicationConsents").unique(),
      projection: await ctx.db.query("publicTestimonialProjections").unique(),
      testimonial: await ctx.db.get(testimonialId),
    }));
    expect(stored.projection).toBeNull();
    expect(stored.testimonial).toMatchObject({
      _id: testimonialId,
      company: "North Star Labs",
      contentVersion: 2,
      moderationStatus: "pending",
      rating: 4,
      role: "CEO",
      submitterEmail: "alice@example.com",
      text: revisionArgs().text,
    });
    expect(stored.consent?.acceptedAt).toBeGreaterThan(0);
  });

  it("allows only one simultaneous revision for the same content version", async () => {
    const t = createConvexTest();
    await createManagedText(t);

    const results = await Promise.allSettled([
      t.mutation(api.submissionManagement.confirmRevision, revisionArgs()),
      t.mutation(api.submissionManagement.confirmRevision, {
        ...revisionArgs(),
        text: "A competing revision must not overwrite the first confirmed version.",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
  });

  it("rotates the link and invalidates the prior token without enumerating unknown emails", async () => {
    const t = createConvexTest();
    await createManagedText(t);
    await t.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      },
    );
    const request = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").unique(),
    );
    const item = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementItems").unique(),
    );
    const derivedToken = await deriveSubmissionManagementToken(
      "m".repeat(64),
      item!.tokenSeed,
    );
    expect(JSON.stringify(item)).not.toContain(derivedToken);
    expect(request).not.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
    await t.mutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      { leaseId: "successful-delivery", requestId: request!._id },
    );
    await t.mutation(
      internal.submissionManagement.finishReplacementLinkRequest,
      {
        leaseId: "successful-delivery",
        requestId: request!._id,
        sent: true,
      },
    );
    await expect(t.run((ctx) => ctx.db.get(request!._id))).resolves.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, {
        token: derivedToken,
      }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
    await expect(
      t.action(api.submissionManagement.requestReplacementLink, {
        email: "unknown@example.com",
        publicSlug: "acme-proof",
      }),
    ).resolves.toEqual({ accepted: true });
  });

  it("keeps the prior link active until durable replacement delivery succeeds", async () => {
    const t = createConvexTest();
    await createManagedText(t);
    await t.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      },
    );
    const request = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").unique(),
    );
    await t.mutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      { leaseId: "failed-delivery", requestId: request!._id },
    );
    await t.mutation(
      internal.submissionManagement.finishReplacementLinkRequest,
      {
        error: "provider unavailable",
        leaseId: "failed-delivery",
        requestId: request!._id,
        sent: false,
      },
    );

    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
  });

  it("purges HMAC material after an exhausted delivery lease expires", async () => {
    const t = createConvexTest();
    await createManagedText(t);
    const requestId = await t.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      },
    );
    await t.run((ctx) =>
      ctx.db.patch(requestId!, {
        attempts: 5,
        leaseExpiresAt: Date.now() - 1,
        leaseId: "crashed-final-attempt",
        status: "sending",
      }),
    );

    await expect(
      t.mutation(internal.submissionManagement.claimReplacementLinkRequest, {
        leaseId: "cleanup",
        requestId: requestId!,
      }),
    ).resolves.toBeNull();
    await expect(
      t.run(async (ctx) => ({
        items: await ctx.db.query("managementLinkReplacementItems").collect(),
        requests: await ctx.db
          .query("managementLinkReplacementRequests")
          .collect(),
      })),
    ).resolves.toEqual({ items: [], requests: [] });
  });

  it("rotates every matching Submission and suppresses concurrent recovery bursts", async () => {
    const t = createConvexTest();
    const { testimonialId } = await createManagedText(t);
    await t.run(async (ctx) => {
      const source = await ctx.db.get(testimonialId);
      const consent = await ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique();
      if (!source || !consent) throw new Error("Expected managed testimonial");
      for (let index = 1; index <= 10; index += 1) {
        const id = await ctx.db.insert("testimonials", {
          ...source,
          _creationTime: undefined,
          _id: undefined,
          clientSubmissionId: `managed-text-${index + 1}`,
          managementTokenHash: await hashSubmissionManagementToken(
            String(index).padStart(64, "b"),
          ),
        });
        await ctx.db.insert("publicationConsents", {
          acceptedAt: consent.acceptedAt,
          brandName: consent.brandName,
          consentText: consent.consentText,
          consentVersion: consent.consentVersion,
          identityFields: consent.identityFields,
          organizationId: consent.organizationId,
          testimonialId: id,
        });
      }
    });
    await Promise.all([
      t.mutation(internal.submissionManagement.queueReplacementLinkRequest, {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      }),
      t.mutation(internal.submissionManagement.queueReplacementLinkRequest, {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      }),
    ]);
    const requests = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").collect(),
    );
    expect(requests).toHaveLength(1);
    const items = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementItems").collect(),
    );
    expect(items).toHaveLength(11);
    await t.mutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      { leaseId: "all-delivered", requestId: requests[0]!._id },
    );
    await t.mutation(
      internal.submissionManagement.finishReplacementLinkRequest,
      {
        leaseId: "all-delivered",
        requestId: requests[0]!._id,
        sent: true,
      },
    );
    const expectedHashes = items.map(({ tokenHash }) => tokenHash);
    const storedHashes = await t.run(async (ctx) =>
      (
        await ctx.db
          .query("testimonials")
          .withIndex("by_organization_submitter_email", (index) =>
            index
              .eq("organizationId", requests[0]!.organizationId!)
              .eq("submitterEmail", "alice@example.com"),
          )
          .collect()
      ).map(({ managementTokenHash }) => managementTokenHash),
    );
    expect(new Set(storedHashes)).toEqual(new Set(expectedHashes));
  });

  it("keeps the old published video until a Ready replacement is confirmed", async () => {
    const t = createConvexTest();
    const { testimonialId, videoAssetId } = await createManagedVideo(t);
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toMatchObject({
      currentVideo: { playbackId: "old-playback", posterTimeSeconds: 15 },
    });
    const upload = await t.action(
      api.submissionManagement.createVideoReplacementUpload,
      {
        expectedContentVersion: 1,
        fileSizeBytes: 2_000,
        mimeType: "video/mp4",
        spokenLanguage: "en",
        token: originalToken,
      },
    );
    const before = await t.run(async (ctx) => ({
      current: await ctx.db.get(videoAssetId),
      projection: await ctx.db.query("publicTestimonialProjections").unique(),
    }));
    expect(before.current?.playbackId).toBe("old-playback");
    expect(before.projection?.type).toBe("video");

    const consent = revisedConsent();
    await t.mutation(api.submissionManagement.confirmRevision, {
      ...revisionArgs(consent),
      revisionId: upload.revisionId,
      text: "",
    });
    const after = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      cleanup: await ctx.db.query("videoProviderCleanupJobs").collect(),
      projection: await ctx.db.query("publicTestimonialProjections").unique(),
      reservations: await ctx.db.query("videoReservations").collect(),
      testimonial: await ctx.db.get(testimonialId),
    }));
    expect(after.testimonial).toMatchObject({
      _id: testimonialId,
      contentVersion: 2,
      moderationStatus: "pending",
    });
    expect(after.projection).toBeNull();
    expect(after.assets).toHaveLength(1);
    expect(after.assets[0]).toMatchObject({ testimonialId, status: "ready" });
    expect(after.reservations).toHaveLength(1);
    expect(after.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ providerAssetId: "old-provider-asset" }),
      ]),
    );
  });

  it("keeps the current video and publication when replacement processing fails", async () => {
    const t = createConvexTest();
    const { testimonialId, videoAssetId } = await createManagedVideo(t);
    const tokenHash = await hashSubmissionManagementToken(originalToken);
    const reserved = await t.mutation(
      internal.submissionManagement.reserveVideoReplacement,
      {
        clientRevisionId: "revision-failed-video",
        expectedContentVersion: 1,
        tokenHash,
      },
    );
    const replacementAssetId = await t.mutation(
      internal.submissionManagement.attachVideoReplacement,
      {
        fileSizeBytes: 2_000,
        mimeType: "video/mp4",
        provider: "fake",
        providerUploadId: "failed-replacement-upload",
        reservationId: reserved.reservationId,
        revisionId: reserved.revisionId,
        spokenLanguage: "en",
        tokenHash,
      },
    );
    await t.run((ctx) =>
      ctx.db.patch(replacementAssetId, {
        failureReason: "processing failed",
        status: "failed",
      }),
    );

    await expect(
      t.mutation(api.submissionManagement.confirmRevision, {
        ...revisionArgs(),
        revisionId: reserved.revisionId,
        text: "",
      }),
    ).rejects.toBeDefined();
    const unchanged = await t.run(async (ctx) => ({
      current: await ctx.db.get(videoAssetId),
      projection: await ctx.db.query("publicTestimonialProjections").unique(),
      testimonial: await ctx.db.get(testimonialId),
    }));
    expect(unchanged.current?.testimonialId).toBe(testimonialId);
    expect(unchanged.projection).not.toBeNull();
    expect(unchanged.testimonial).toMatchObject({
      contentVersion: 1,
      moderationStatus: "published",
    });
  });

  it("releases an interrupted replacement upload so the Submitter can retry", async () => {
    const t = createConvexTest();
    const { testimonialId, videoAssetId } = await createManagedVideo(t);
    const tokenHash = await hashSubmissionManagementToken(originalToken);
    const reserved = await t.mutation(
      internal.submissionManagement.reserveVideoReplacement,
      {
        clientRevisionId: "revision-cancelled-video",
        expectedContentVersion: 1,
        tokenHash,
      },
    );
    const replacementAssetId = await t.mutation(
      internal.submissionManagement.attachVideoReplacement,
      {
        fileSizeBytes: 2_000,
        mimeType: "video/mp4",
        provider: "mux",
        providerUploadId: "cancelled-replacement-upload",
        reservationId: reserved.reservationId,
        revisionId: reserved.revisionId,
        spokenLanguage: "en",
        tokenHash,
      },
    );

    await expect(
      t.mutation(api.submissionManagement.cancelVideoReplacement, {
        reservationId: reserved.reservationId,
        revisionId: reserved.revisionId,
        token: originalToken,
      }),
    ).resolves.toBeNull();

    const cancelled = await t.run(async (ctx) => ({
      current: await ctx.db.get(videoAssetId),
      replacement: await ctx.db.get(replacementAssetId),
      reservation: await ctx.db.get(reserved.reservationId),
      revision: await ctx.db.get(reserved.revisionId),
      cleanup: await ctx.db.query("videoProviderCleanupJobs").collect(),
    }));
    expect(cancelled.current?.testimonialId).toBe(testimonialId);
    expect(cancelled.replacement).toBeNull();
    expect(cancelled.reservation?.status).toBe("released");
    expect(cancelled.revision?.status).toBe("superseded");
    expect(cancelled.cleanup).toEqual([
      expect.objectContaining({
        providerUploadId: "cancelled-replacement-upload",
        testimonialId,
      }),
    ]);
    await expect(
      t.mutation(internal.submissionManagement.reserveVideoReplacement, {
        clientRevisionId: "revision-after-cancel",
        expectedContentVersion: 1,
        tokenHash,
      }),
    ).resolves.toMatchObject({ testimonialId });
  });

  it("blocks replacement video storage during payment grace", async () => {
    const t = createConvexTest();
    const { brand } = await createManagedVideo(t);
    await addStripeSubscription(t, brand.id, "past_due");

    await expect(
      t.mutation(internal.submissionManagement.reserveVideoReplacement, {
        clientRevisionId: "payment-grace-replacement",
        expectedContentVersion: 1,
        tokenHash: await hashSubmissionManagementToken(originalToken),
      }),
    ).rejects.toMatchObject({
      data: { code: "PAYMENT_GRACE_VIDEO_BLOCKED" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("submissionVideoRevisions").collect()),
    ).resolves.toEqual([]);
  });

  it("lets Owner deletion remove an in-progress replacement without orphaning media", async () => {
    const t = createConvexTest();
    const { brand, owner, testimonialId } = await createManagedVideo(t);
    await t.action(api.submissionManagement.createVideoReplacementUpload, {
      expectedContentVersion: 1,
      fileSizeBytes: 2_000,
      mimeType: "video/mp4",
      spokenLanguage: "en",
      token: originalToken,
    });

    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).resolves.toEqual({ deleted: true });
    await expect(
      t.run(async (ctx) => ({
        assets: await ctx.db.query("videoAssets").collect(),
        revisions: await ctx.db.query("submissionVideoRevisions").collect(),
        testimonials: await ctx.db.query("testimonials").collect(),
      })),
    ).resolves.toEqual({ assets: [], revisions: [], testimonials: [] });
  });

  it("refuses a replacement attached after permanent deletion was prepared", async () => {
    const t = createConvexTest();
    const { brand, owner, testimonialId } = await createManagedVideo(t);
    const tokenHash = await hashSubmissionManagementToken(originalToken);
    const reserved = await t.mutation(
      internal.submissionManagement.reserveVideoReplacement,
      {
        clientRevisionId: "deletion-race-revision",
        expectedContentVersion: 1,
        tokenHash,
      },
    );
    await owner.client.mutation(internal.videoMedia.prepareRemoval, {
      organizationId: brand.id,
      testimonialId,
    });

    await expect(
      t.mutation(internal.submissionManagement.attachVideoReplacement, {
        fileSizeBytes: 2_000,
        mimeType: "video/mp4",
        provider: "fake",
        providerUploadId: "late-upload",
        reservationId: reserved.reservationId,
        revisionId: reserved.revisionId,
        spokenLanguage: "en",
        tokenHash,
      }),
    ).rejects.toBeDefined();
    await expect(
      t.run((ctx) =>
        ctx.db
          .query("videoAssets")
          .withIndex("by_provider_upload_id", (index) =>
            index.eq("providerUploadId", "late-upload"),
          )
          .unique(),
      ),
    ).resolves.toBeNull();
    await t.mutation(
      internal.submissionManagement.recordDetachedReplacementUpload,
      {
        organizationId: brand.id,
        provider: "fake",
        providerUploadId: "late-upload",
        reservationId: reserved.reservationId,
        testimonialId,
      },
    );
    await expect(
      t.run((ctx) =>
        ctx.db
          .query("videoProviderCleanupJobs")
          .withIndex("by_provider_upload", (index) =>
            index.eq("provider", "fake").eq("providerUploadId", "late-upload"),
          )
          .unique(),
      ),
    ).resolves.toMatchObject({ providerUploadId: "late-upload" });
  });

  it("records detached provider cleanup after withdrawal removed the reservation", async () => {
    const t = createConvexTest();
    const { brand, testimonialId } = await createManagedVideo(t);
    const reserved = await t.mutation(
      internal.submissionManagement.reserveVideoReplacement,
      {
        clientRevisionId: "withdrawal-race-revision",
        expectedContentVersion: 1,
        tokenHash: await hashSubmissionManagementToken(originalToken),
      },
    );

    await t.mutation(api.submissionManagement.withdrawConsent, {
      token: originalToken,
    });
    await expect(
      t.run((ctx) => ctx.db.get(reserved.reservationId)),
    ).resolves.toBeNull();
    await t.mutation(
      internal.submissionManagement.recordDetachedReplacementUpload,
      {
        organizationId: brand.id,
        provider: "fake",
        providerUploadId: "withdrawn-late-upload",
        reservationId: reserved.reservationId,
        testimonialId,
      },
    );

    await expect(
      t.run((ctx) =>
        ctx.db
          .query("videoProviderCleanupJobs")
          .withIndex("by_provider_upload", (index) =>
            index
              .eq("provider", "fake")
              .eq("providerUploadId", "withdrawn-late-upload"),
          )
          .unique(),
      ),
    ).resolves.toMatchObject({
      organizationId: brand.id,
      providerUploadId: "withdrawn-late-upload",
    });
  });

  it("refuses to confirm a Ready video replacement after permanent deletion was prepared", async () => {
    const t = createConvexTest();
    const { brand, owner, testimonialId } = await createManagedVideo(t);
    const upload = await t.action(
      api.submissionManagement.createVideoReplacementUpload,
      {
        expectedContentVersion: 1,
        fileSizeBytes: 2_000,
        mimeType: "video/mp4",
        spokenLanguage: "en",
        token: originalToken,
      },
    );
    await owner.client.mutation(internal.videoMedia.prepareRemoval, {
      organizationId: brand.id,
      testimonialId,
    });

    await expect(
      t.mutation(api.submissionManagement.confirmRevision, {
        ...revisionArgs(),
        revisionId: upload.revisionId,
        text: "",
      }),
    ).rejects.toBeDefined();
  });

  it("withdraws only one item from a grouped link delivery", async () => {
    const t = createConvexTest();
    const { brand, consent, testimonialId } = await createManagedText(t);
    const secondToken = "d".repeat(64);
    const secondId = await t.run(async (ctx) => {
      const now = Date.now();
      const id = await ctx.db.insert("testimonials", {
        clientSubmissionId: "managed-text-second",
        contentVersion: 1,
        createdAt: now,
        managementTokenHash: await hashSubmissionManagementToken(secondToken),
        moderationStatus: "pending",
        organizationId: brand.id,
        submissionType: "text",
        submitterEmail: "alice@example.com",
        submitterName: "Alice Martin",
        text: "A second testimonial managed by the same original email.",
        updatedAt: now,
      });
      await ctx.db.insert("publicationConsents", {
        acceptedAt: now,
        brandName: brand.name,
        consentText: consent.text,
        consentVersion: consent.version,
        identityFields: consent.identityFields,
        organizationId: brand.id,
        testimonialId: id,
      });
      return id;
    });
    await t.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      },
    );
    const request = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").unique(),
    );
    const items = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementItems").collect(),
    );
    const secondItem = items.find((item) => item.testimonialId === secondId)!;
    await t.mutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      { leaseId: "delivered-batch", requestId: request!._id },
    );

    await t.mutation(api.submissionManagement.withdrawConsent, {
      token: originalToken,
    });
    await t.mutation(
      internal.submissionManagement.finishReplacementLinkRequest,
      {
        leaseId: "delivered-batch",
        requestId: request!._id,
        sent: true,
      },
    );

    await expect(t.run((ctx) => ctx.db.get(testimonialId))).resolves.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, {
        token: await deriveSubmissionManagementToken(
          "m".repeat(64),
          secondItem.tokenSeed,
        ),
      }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
  });

  it("excludes deferred deleted items when claiming a grouped replacement delivery", async () => {
    const t = createConvexTest();
    const { brand, testimonialId } = await createManagedText(t);
    const secondId = await t.run(async (ctx) => {
      const original = (await ctx.db.get(testimonialId))!;
      const { _id, _creationTime, ...fields } = original;
      void _id;
      void _creationTime;
      return ctx.db.insert("testimonials", {
        ...fields,
        clientSubmissionId: "sibling",
        managementTokenHash: "sibling-hash",
      });
    });
    const requestId = (await t.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "alice@example.com",
        publicSlug: "acme-proof",
        scheduleDelivery: false,
      },
    ))!;
    await t.run(async (ctx) => {
      for (let index = 0; index < 64; index++)
        await ctx.db.insert("managementLinkReplacementItems", {
          createdAt: Date.now(),
          organizationId: brand.id,
          requestId,
          testimonialId,
          tokenHash: `deferred-hash-${index}`,
          tokenSeed: `deferred-seed-${index}`,
        });
    });
    await t.mutation(api.submissionManagement.withdrawConsent, {
      token: originalToken,
    });
    expect(
      (
        await t.run((ctx) =>
          ctx.db.query("managementLinkReplacementItems").collect(),
        )
      ).length,
    ).toBeGreaterThan(1);
    const claim = await t.mutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      {
        requestId,
        leaseId: "sibling-delivery",
      },
    );
    expect(claim?.items.map((item) => item.testimonialId)).toEqual([secondId]);
    await t.mutation(
      internal.submissionManagement.finishReplacementLinkRequest,
      {
        requestId,
        leaseId: "sibling-delivery",
        sent: true,
      },
    );
    expect(await t.run((ctx) => ctx.db.get(requestId))).toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db.query("managementLinkReplacementItems").collect(),
      ),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(testimonialId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(secondId))).not.toBeNull();
  });

  it("withdraws consent idempotently, invalidates public content, and leaves only content-free audit", async () => {
    const t = createConvexTest();
    const { brand, testimonialId } = await createManagedVideo(t);
    await t.run((ctx) =>
      ctx.db.insert("auditEvents", {
        actorDisplayName: "Owner",
        actorUserId: "owner",
        eventType: "testimonial.published",
        occurredAt: Date.now(),
        organizationId: brand.id,
        targetId: String(testimonialId),
        targetLabel: "Alice Martin",
        targetType: "testimonial",
      }),
    );

    await expect(
      t.mutation(api.submissionManagement.withdrawConsent, {
        token: originalToken,
      }),
    ).resolves.toEqual({ withdrawn: true });
    await expect(
      t.mutation(api.submissionManagement.withdrawConsent, {
        token: originalToken,
      }),
    ).resolves.toEqual({ withdrawn: true });

    const stored = await t.run(async (ctx) => ({
      audit: await ctx.db.query("auditEvents").collect(),
      consents: await ctx.db.query("publicationConsents").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(stored.testimonials).toEqual([]);
    expect(stored.consents).toEqual([]);
    expect(stored.projections).toEqual([]);
    const withdrawalAudit = stored.audit.filter(
      ({ eventType }) => eventType === "testimonial.consent_withdrawn",
    );
    expect(withdrawalAudit).toEqual([
      expect.objectContaining({
        eventType: "testimonial.consent_withdrawn",
        targetId: String(testimonialId),
        targetLabel: "Withdrawn Testimonial",
      }),
    ]);
    expect(JSON.stringify(withdrawalAudit)).not.toContain("Alice");
    expect(JSON.stringify(withdrawalAudit)).not.toContain("old-playback");
    expect(
      stored.audit.filter(({ targetType }) => targetType === "testimonial"),
    ).toHaveLength(1);
  });

  it.each(["withdrawal", "spam-expiry"])(
    "purges multiple batches after %s without losing media cleanup or quota history",
    async (reason) => {
      vi.useFakeTimers();
      vi.stubEnv("MUX_TOKEN_ID", "test-token");
      vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
      const providerRequests: string[] = [];
      let failedOnce = false;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          providerRequests.push(url);
          if (url.endsWith("/assets/retry-source-0") && !failedOnce) {
            failedOnce = true;
            return new Response(null, { status: 503 });
          }
          return new Response(null, { status: 204 });
        }),
      );
      try {
        const t = createConvexTest();
        const { brand, owner, testimonialId, videoAssetId } =
          await createManagedVideo(t);
        const now = Date.now();
        const quarantineId = await t.run(async (ctx) => {
          await ctx.db.insert("collectionCredits", {
            organizationId: brand.id,
            testimonialId,
            submissionType: "video",
            consumedAt: now,
            restorationMode: "automatic",
            restoredAt: now,
          });
          const quarantineId = await ctx.db.insert("spamQuarantines", {
            organizationId: brand.id,
            testimonialId,
            creditRestored: true,
            expiresAt: now - 1,
            previousModerationStatus: "published",
            reportedAt: now,
            restorationMode: "automatic",
            status: "active",
            updatedAt: now,
          });
          if (reason === "spam-expiry")
            await ctx.db.patch(testimonialId, { moderationStatus: "spam" });
          for (let index = 0; index < 65; index++) {
            await ctx.db.insert("submissionEmailDeliveries", {
              organizationId: brand.id,
              testimonialId,
              recipientKind: "submitter",
              recipientEmail: "alice@example.com",
              attemptId: String(index),
              attemptLeaseExpiresAt: now,
              status: "sent",
              createdAt: now,
              updatedAt: now,
            });
            for (const kind of ["retry", "revision"] as const) {
              const reservationId = await ctx.db.insert("videoReservations", {
                organizationId: brand.id,
                clientSubmissionId: `${kind}-${index}`,
                plan: "free",
                status: "released",
                expiresAt: now,
                createdAt: now,
                updatedAt: now,
              });
              const assetId = await ctx.db.insert("videoAssets", {
                organizationId: brand.id,
                reservationId,
                provider: "mux",
                providerUploadId: `${kind}-upload-${index}`,
                ...(index % 2 === 0
                  ? {
                      providerAssetId: `${kind}-source-${index}`,
                      downloadProviderAssetId: `${kind}-download-${index}`,
                    }
                  : {}),
                spokenLanguage: "en",
                mimeType: "video/mp4",
                fileSizeBytes: 1,
                status: "failed",
                captionsStatus: "failed",
                createdAt: now,
                updatedAt: now,
              });
              if (kind === "retry") {
                const replacementReservationId = await ctx.db.insert(
                  "videoReservations",
                  {
                    organizationId: brand.id,
                    clientSubmissionId: `late-${index}`,
                    plan: "free",
                    status: "reserved",
                    expiresAt: now + 60_000,
                    createdAt: now,
                    updatedAt: now,
                  },
                );
                await ctx.db.insert("videoRetryLinks", {
                  replacementReservationId,
                  organizationId: brand.id,
                  testimonialId,
                  videoAssetId: assetId,
                  tokenHash: `retry-hash-${index}`,
                  tokenSeed: `retry-seed-${index}`,
                  expiresAt: now,
                  createdAt: now,
                });
              } else
                await ctx.db.insert("submissionVideoRevisions", {
                  organizationId: brand.id,
                  testimonialId,
                  videoAssetId: assetId,
                  reservationId,
                  baseContentVersion: 1,
                  status: "superseded",
                  createdAt: now,
                  updatedAt: now,
                });
            }
          }
          for (let index = 0; index < 129; index++)
            await ctx.db.insert("auditEvents", {
              organizationId: brand.id,
              actorDisplayName: "Owner",
              actorUserId: "owner",
              targetType: "testimonial",
              targetId: String(testimonialId),
              targetLabel: "Alice Martin",
              eventType: "testimonial.published",
              occurredAt: now,
            });
          return quarantineId;
        });
        if (reason === "withdrawal")
          await t.mutation(api.submissionManagement.withdrawConsent, {
            token: originalToken,
          });
        else
          await t.mutation(
            internal.testimonialModeration.expireSpamQuarantine,
            { quarantineId },
          );
        await expect(
          t.run((ctx) => ctx.db.get(testimonialId)),
        ).resolves.toBeNull();
        await expect(
          t.run((ctx) => ctx.db.get(videoAssetId)),
        ).resolves.toBeNull();
        expect(
          await t.run((ctx) =>
            ctx.db.query("publicTestimonialProjections").collect(),
          ),
        ).toEqual([]);
        expect(
          (await t.run((ctx) => ctx.db.query("videoRetryLinks").collect()))
            .length,
        ).toBeGreaterThan(0);
        await expect(
          t.query(api.submissionManagement.get, { token: originalToken }),
        ).resolves.toBeNull();
        await expect(
          owner.client.mutation(api.testimonialModeration.setStatus, {
            organizationId: brand.id,
            testimonialId,
            status: "published",
          }),
        ).rejects.toThrow();
        await t.finishAllScheduledFunctions(() => vi.runAllTimers(), 1000);
        await t.mutation(
          internal.testimonialDeletion.continueTestimonialRelationshipPurge,
          {
            organizationId: brand.id,
            testimonialId,
            includeVideoRelations: true,
            preserveQuarantines: true,
          },
        );
        const remaining = await t.run(async (ctx) => ({
          deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
          links: await ctx.db.query("videoRetryLinks").collect(),
          revisions: await ctx.db.query("submissionVideoRevisions").collect(),
          assets: await ctx.db.query("videoAssets").collect(),
          reservations: await ctx.db.query("videoReservations").collect(),
          jobs: await ctx.db.query("videoProviderCleanupJobs").collect(),
          audits: await ctx.db
            .query("auditEvents")
            .withIndex("by_organization_target", (index) =>
              index
                .eq("organizationId", brand.id)
                .eq("targetType", "testimonial")
                .eq("targetId", String(testimonialId)),
            )
            .collect(),
          credit: await ctx.db.query("collectionCredits").unique(),
          quarantine: await ctx.db.get(quarantineId),
        }));
        for (const records of [
          remaining.deliveries,
          remaining.links,
          remaining.revisions,
          remaining.assets,
          remaining.reservations,
          remaining.jobs,
        ])
          expect(records).toEqual([]);
        expect(remaining.audits).toHaveLength(1);
        expect(remaining.audits[0]?.eventType).toBe(
          reason === "withdrawal"
            ? "testimonial.consent_withdrawn"
            : "testimonial.spam_expired",
        );
        expect(JSON.stringify(remaining.audits)).not.toContain("Alice");
        expect(remaining.credit?.restoredAt).toBe(now);
        expect(remaining.quarantine?.restorationMode).toBe("automatic");
        expect(remaining.quarantine?.status).toBe(
          reason === "withdrawal" ? "active" : "expired",
        );
        expect(failedOnce).toBe(true);
        expect(
          providerRequests.filter((url) =>
            url.endsWith("/assets/retry-source-0"),
          ),
        ).toHaveLength(2);
        for (let index = 0; index < 65; index++)
          for (const kind of ["retry", "revision"]) {
            if (index % 2 === 0) {
              expect(providerRequests).toContain(
                `https://api.mux.com/video/v1/assets/${kind}-source-${index}`,
              );
              expect(providerRequests).toContain(
                `https://api.mux.com/video/v1/assets/${kind}-download-${index}`,
              );
            } else
              expect(providerRequests).toContain(
                `https://api.mux.com/video/v1/uploads/${kind}-upload-${index}/cancel`,
              );
          }
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    },
  );

  it("keeps withdrawal authoritative when it races a revision confirmation", async () => {
    const t = createConvexTest();
    await createManagedText(t, { published: true });

    const outcomes = await Promise.allSettled([
      t.mutation(api.submissionManagement.confirmRevision, revisionArgs()),
      t.mutation(api.submissionManagement.withdrawConsent, {
        token: originalToken,
      }),
    ]);

    expect(outcomes[1]).toMatchObject({
      status: "fulfilled",
      value: { withdrawn: true },
    });
    await expect(
      t.run(async (ctx) => ({
        projections: await ctx.db
          .query("publicTestimonialProjections")
          .collect(),
        testimonials: await ctx.db.query("testimonials").collect(),
      })),
    ).resolves.toEqual({ projections: [], testimonials: [] });
  });
});
