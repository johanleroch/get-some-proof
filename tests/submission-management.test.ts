import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  buildPublicationConsent,
  hashSubmissionManagementToken,
} from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

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
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
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
      },
    );
    const request = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").unique(),
    );
    expect(request).not.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
    await t.action(
      internal.submissionManagement.processReplacementLinkRequest,
      { requestId: request!._id },
    );
    await expect(
      t.query(api.submissionManagement.get, { token: originalToken }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.submissionManagement.get, {
        token: request!.items[0]!.token,
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
      { email: "alice@example.com", publicSlug: "acme-proof" },
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
      }),
      t.mutation(internal.submissionManagement.queueReplacementLinkRequest, {
        email: "alice@example.com",
        publicSlug: "acme-proof",
      }),
    ]);
    const requests = await t.run((ctx) =>
      ctx.db.query("managementLinkReplacementRequests").collect(),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.items).toHaveLength(11);
    await t.action(
      internal.submissionManagement.processReplacementLinkRequest,
      { requestId: requests[0]!._id },
    );
    const expectedHashes = await Promise.all(
      requests[0]!.items.map(({ token }) =>
        hashSubmissionManagementToken(token),
      ),
    );
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
