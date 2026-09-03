import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import { hashSubmissionManagementToken } from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

describe("Video Testimonial collection", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("atomically reserves only the two Free lifetime video credits", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    const attempts = await Promise.allSettled(
      ["video-client-one", "video-client-two", "video-client-three"].map(
        (clientSubmissionId) =>
          t.action(api.video.createDirectUpload, {
            clientSubmissionId,
            fileSizeBytes: 1_024,
            mimeType: "video/mp4",
            publicSlug: "acme-proof",
            spokenLanguage: "fr",
          }),
      ),
    );

    expect(
      attempts.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(2);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    await expect(
      t.run((ctx) => ctx.db.query("videoReservations").collect()),
    ).resolves.toHaveLength(2);
  });

  it("creates one private Pending Video Testimonial after a direct upload", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "video-client-submit",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: {
        avatarSupplied: false,
        name: "Alice Martin",
      },
    });

    const result = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "video-client-submit",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 72.5,
      reservationId: upload.reservationId,
      submitterEmail: "ALICE@example.com",
      submitterName: "Alice Martin",
    });

    expect(result).toMatchObject({
      moderationStatus: "pending",
      processingStatus: "ready",
    });
    const stored = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      consents: await ctx.db.query("publicationConsents").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(stored.testimonials).toEqual([
      expect.objectContaining({
        moderationStatus: "pending",
        organizationId: brand.id,
        submissionType: "video",
        submitterEmail: "alice@example.com",
      }),
    ]);
    expect(stored.assets[0]).toMatchObject({
      durationSeconds: 72.5,
      testimonialId: stored.testimonials[0]._id,
    });
    expect(stored.consents).toHaveLength(1);
  });

  it("processes duplicate and out-of-order signed Mux events exactly once", async () => {
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "video-client-events",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });

    const readyEvent = {
      data: {
        duration: 54,
        id: "mux-asset-ready",
        passthrough: upload.reservationId,
        playback_ids: [{ id: "playback-public", policy: "public" }],
      },
      id: "event-ready-1",
      type: "video.asset.ready",
    };
    const first = await t.action(api.videoWebhooks.ingest, {
      event: readyEvent,
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    const duplicate = await t.action(api.videoWebhooks.ingest, {
      event: readyEvent,
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: {
          asset_id: "mux-asset-ready",
          id: "ignored-upload-id",
          passthrough: upload.reservationId,
        },
        id: "event-upload-late",
        type: "video.upload.asset_created",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });

    expect(first).toEqual({ outcome: "ready" });
    expect(duplicate).toEqual({ outcome: "duplicate" });
    const stored = await t.run(async (ctx) => ({
      asset: await ctx.db.query("videoAssets").unique(),
      events: await ctx.db.query("videoWebhookEvents").collect(),
      reservation: await ctx.db.get(upload.reservationId),
    }));
    expect(stored.asset).toMatchObject({
      captionsStatus: "requested",
      durationSeconds: 54,
      playbackId: "playback-public",
      providerAssetId: "mux-asset-ready",
      status: "ready",
    });
    expect(stored.reservation?.status).toBe("consumed");
    expect(stored.events).toHaveLength(2);
  });

  it("attaches a Ready asset when Mux wins the race before submission", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "ready-before-submit",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: {
          duration: 25,
          id: "fast-mux-asset",
          passthrough: upload.reservationId,
          playback_ids: [{ id: "fast-playback", policy: "public" }],
        },
        id: "fast-ready-event",
        type: "video.asset.ready",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });

    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "ready-before-submit",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 24,
      reservationId: upload.reservationId,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
    });

    expect(submitted.processingStatus).toBe("ready");
    await expect(
      t.run((ctx) => ctx.db.query("videoAssets").unique()),
    ).resolves.toMatchObject({
      durationSeconds: 25,
      status: "ready",
      testimonialId: submitted.testimonialId,
    });
  });

  it("keeps an uncertain committed submission idempotent and upload intact", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "uncertain-video-submit",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });
    const submission = {
      ageConfirmed: true,
      clientSubmissionId: "uncertain-video-submit",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 30,
      reservationId: upload.reservationId,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
    };
    const first = await t.action(api.video.submit, submission);

    await t.mutation(api.video.cancelUpload, {
      clientSubmissionId: submission.clientSubmissionId,
      reservationId: upload.reservationId,
    });
    const repeated = await t.action(api.video.submit, submission);

    expect(repeated.testimonialId).toBe(first.testimonialId);
    const stored = await t.run(async (ctx) => ({
      asset: await ctx.db.query("videoAssets").unique(),
      reservations: await ctx.db.query("videoReservations").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(stored.testimonials).toHaveLength(1);
    expect(stored.asset).toMatchObject({
      status: "awaiting_upload",
      testimonialId: first.testimonialId,
    });
    expect(stored.reservations[0]?.status).toBe("reserved");
  });

  it("rejects a Ready event that arrives after the reservation deadline", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const upload = await t.action(api.video.createDirectUpload, {
        clientSubmissionId: "late-ready-event",
        fileSizeBytes: 2_048,
        mimeType: "video/mp4",
        publicSlug: "acme-proof",
        spokenLanguage: "en",
      });
      vi.setSystemTime(new Date(startedAt.getTime() + 2 * 60 * 60 * 1_000 + 1));

      await expect(
        t.action(api.videoWebhooks.ingest, {
          event: {
            data: {
              duration: 25,
              id: "late-mux-asset",
              passthrough: upload.reservationId,
              playback_ids: [{ id: "late-playback", policy: "public" }],
            },
            id: "late-ready-event",
            type: "video.asset.ready",
          },
          ingestSecret: "test-ingest-secret-with-at-least-32-characters",
        }),
      ).resolves.toEqual({ outcome: "released" });
      const stored = await t.run(async (ctx) => ({
        asset: await ctx.db.query("videoAssets").unique(),
        reservation: await ctx.db.get(upload.reservationId),
      }));
      expect(stored.asset).toMatchObject({ status: "failed" });
      expect(stored.reservation?.status).toBe("released");
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases capacity when authoritative processing rejects an overlong video", async () => {
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "video-client-long",
      fileSizeBytes: 2_048,
      mimeType: "video/webm",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });
    await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "video-client-long",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 110,
      reservationId: upload.reservationId,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
    });

    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: {
          duration: 120.1,
          id: "mux-asset-too-long",
          passthrough: upload.reservationId,
          playback_ids: [{ id: "should-not-publish", policy: "public" }],
        },
        id: "event-too-long",
        type: "video.asset.ready",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });

    const stored = await t.run(async (ctx) => ({
      asset: await ctx.db.query("videoAssets").unique(),
      reservation: await ctx.db.get(upload.reservationId),
      retry: await ctx.db.query("videoRetryLinks").unique(),
    }));
    expect(stored.asset).toMatchObject({
      failureReason: "Video must be no longer than 2 minutes.",
      status: "failed",
    });
    expect(stored.asset?.playbackId).toBeUndefined();
    expect(stored.reservation?.status).toBe("released");
    expect(stored.retry).toMatchObject({
      testimonialId: stored.asset?.testimonialId,
    });
  });

  it("creates one hashed 24-hour retry link and consumes it only once", async () => {
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "video-client-retry",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });
    await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "video-client-retry",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 30,
      reservationId: upload.reservationId,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
    });

    vi.useFakeTimers();
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: { id: "failed-asset", passthrough: upload.reservationId },
        id: "event-processing-failed",
        type: "video.asset.errored",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: { id: "failed-asset", passthrough: upload.reservationId },
        id: "event-processing-failed-followup",
        type: "video.upload.errored",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    const retry = await t.run((ctx) =>
      ctx.db.query("videoRetryLinks").unique(),
    );
    if (!retry) throw new Error("Retry link missing.");
    expect(retry.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(retry).not.toHaveProperty("token");
    expect(retry.expiresAt - retry.createdAt).toBe(24 * 60 * 60 * 1_000);
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_FROM", "proof@example.com");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await t.action(internal.videoRetryDelivery.deliver, {
      retryLinkId: retry._id,
    });
    await expect(t.run((ctx) => ctx.db.get(retry._id))).resolves.toMatchObject({
      deliveryAttempts: 1,
      deliveryStatus: "failed",
    });
    vi.unstubAllGlobals();
    vi.stubEnv("EMAIL_PROVIDER", "test");
    await t.action(internal.videoRetryDelivery.deliver, {
      retryLinkId: retry._id,
    });
    await expect(t.run((ctx) => ctx.db.get(retry._id))).resolves.toMatchObject({
      deliveredAt: expect.any(Number),
      deliveryAttempts: 2,
      deliveryStatus: "sent",
    });

    const knownToken = "known-video-retry-token";
    const knownTokenHash = await hashSubmissionManagementToken(knownToken);
    await t.run((ctx) =>
      ctx.db.patch(retry._id, {
        tokenHash: knownTokenHash,
      }),
    );
    await expect(
      t.query(api.video.getRetryContext, { token: knownToken }),
    ).resolves.toMatchObject({ brandName: "Acme Studio" });
    const outsider = await authenticatedUser(t, {
      email: "outsider@example.com",
      name: "Outsider",
    });
    await expect(
      outsider.client.mutation(api.video.revokeRetryLinks, {
        organizationId: brand.id,
        testimonialId: retry.testimonialId,
      }),
    ).rejects.toBeDefined();
    await expect(
      owner.client.mutation(api.video.revokeRetryLinks, {
        organizationId: brand.id,
        testimonialId: retry.testimonialId,
      }),
    ).resolves.toEqual({ revoked: 1 });
    await expect(
      t.query(api.video.getRetryContext, { token: knownToken }),
    ).resolves.toBeNull();
    await t.run((ctx) =>
      ctx.db.patch(retry._id, { expiresAt: Date.now() + 60_000 }),
    );
    const reservedReplacement = await t.mutation(
      internal.video.reserveRetryCapacity,
      {
        clientSubmissionId: "cancelled-replacement",
        tokenHash: knownTokenHash,
      },
    );
    await t.mutation(internal.video.attachRetryProviderUpload, {
      failedVideoAssetId: reservedReplacement.failedVideoAssetId,
      fileSizeBytes: 4_096,
      mimeType: "video/webm",
      provider: "mux",
      providerUploadId: "cancelled-provider-upload",
      reservationId: reservedReplacement.reservationId,
      spokenLanguage: "en",
      testimonialId: reservedReplacement.testimonialId,
      tokenHash: knownTokenHash,
    });
    await expect(
      t.mutation(api.video.cancelRetryUpload, {
        clientSubmissionId: "cancelled-replacement",
        reservationId: reservedReplacement.reservationId,
        token: knownToken,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.video.getRetryContext, { token: knownToken }),
    ).resolves.toMatchObject({ brandName: "Acme Studio" });
    const restored = await t.run(async (ctx) => ({
      failedAsset: await ctx.db.get(retry.videoAssetId),
      replacementAsset: await ctx.db
        .query("videoAssets")
        .withIndex("by_reservation", (index) =>
          index.eq("reservationId", reservedReplacement.reservationId),
        )
        .unique(),
      reservation: await ctx.db.get(reservedReplacement.reservationId),
      retry: await ctx.db.get(retry._id),
    }));
    expect(restored.failedAsset?.testimonialId).toBe(retry.testimonialId);
    expect(restored.replacementAsset).toBeNull();
    expect(restored.reservation?.status).toBe("released");
    expect(restored.retry?.usedAt).toBeUndefined();

    vi.stubEnv("MUX_PROVIDER", "fake");
    await expect(
      t.action(api.video.createRetryDirectUpload, {
        clientSubmissionId: "video-client-replacement",
        fileSizeBytes: 4_096,
        mimeType: "video/webm",
        spokenLanguage: "en",
        token: knownToken,
      }),
    ).resolves.toMatchObject({ provider: "fake" });
    await expect(
      t.action(api.video.createRetryDirectUpload, {
        clientSubmissionId: "video-client-replacement-two",
        fileSizeBytes: 4_096,
        mimeType: "video/webm",
        spokenLanguage: "en",
        token: knownToken,
      }),
    ).rejects.toMatchObject({ data: { code: "VIDEO_RETRY_UNAVAILABLE" } });
    const replaced = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      reservations: await ctx.db.query("videoReservations").collect(),
    }));
    expect(
      replaced.assets.find(
        (asset) => asset.testimonialId === retry.testimonialId,
      ),
    ).toMatchObject({
      captionsStatus: "ready",
      mimeType: "video/webm",
      spokenLanguage: "en",
      status: "ready",
    });
    expect(
      replaced.reservations.filter(({ status }) => status === "consumed"),
    ).toHaveLength(1);
  });

  it("rejects unsupported files before retaining a reservation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    await expect(
      t.action(api.video.createDirectUpload, {
        clientSubmissionId: "unsupported-video-client",
        fileSizeBytes: 100,
        mimeType: "image/png",
        publicSlug: "acme-proof",
        spokenLanguage: "en",
      }),
    ).rejects.toMatchObject({ data: { code: "UNSUPPORTED_VIDEO" } });
    await expect(
      t.run((ctx) => ctx.db.query("videoReservations").collect()),
    ).resolves.toEqual([]);
  });

  it("creates a fresh provider correlation for the same browser retry", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const first = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "same-browser-retry",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    await t.mutation(api.video.cancelUpload, {
      clientSubmissionId: "same-browser-retry",
      reservationId: first.reservationId,
    });

    const second = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "same-browser-retry",
      fileSizeBytes: 4_096,
      mimeType: "video/webm;codecs=vp8,opus",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });

    expect(second.reservationId).not.toBe(first.reservationId);
    await expect(
      t.action(api.videoWebhooks.ingest, {
        event: {
          data: {
            asset_id: "stale-provider-asset",
            passthrough: first.reservationId,
          },
          id: "stale-first-attempt-event",
          type: "video.upload.asset_created",
        },
        ingestSecret: "test-ingest-secret-with-at-least-32-characters",
      }),
    ).resolves.toEqual({ outcome: "ignored" });
    const stored = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      reservations: await ctx.db.query("videoReservations").collect(),
    }));
    expect(stored.reservations).toHaveLength(1);
    expect(stored.assets).toHaveLength(1);
    expect(stored.assets[0]).toMatchObject({
      mimeType: "video/webm",
      status: "awaiting_upload",
    });
  });

  it("releases an abandoned upload reservation after two hours", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const upload = await t.action(api.video.createDirectUpload, {
        clientSubmissionId: "abandoned-video-client",
        fileSizeBytes: 2_048,
        mimeType: "video/mp4",
        publicSlug: "acme-proof",
        spokenLanguage: "en",
      });

      vi.setSystemTime(new Date(startedAt.getTime() + 2 * 60 * 60 * 1_000 + 1));
      await t.action(internal.video.expireReservation, {
        reservationId: upload.reservationId,
      });

      const stored = await t.run(async (ctx) => ({
        asset: await ctx.db.query("videoAssets").unique(),
        reservation: await ctx.db.get(upload.reservationId),
      }));
      expect(stored.asset).toMatchObject({ status: "failed" });
      expect(stored.reservation?.status).toBe("released");
    } finally {
      vi.useRealTimers();
    }
  });

  it("delivers a retry link when a submitted upload times out after departure", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const upload = await t.action(api.video.createDirectUpload, {
        clientSubmissionId: "timed-out-submitted-video",
        fileSizeBytes: 2_048,
        mimeType: "video/mp4",
        publicSlug: "acme-proof",
        spokenLanguage: "en",
      });
      vi.stubEnv("MUX_PROVIDER", "mux");
      const consent = buildPublicationConsent({
        brandName: "Acme Studio",
        privacyContact: "alice@example.com",
        suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
      });
      await t.action(api.video.submit, {
        ageConfirmed: true,
        clientSubmissionId: "timed-out-submitted-video",
        consentAccepted: true,
        consentText: consent.text,
        consentVersion: consent.version,
        durationSeconds: 30,
        reservationId: upload.reservationId,
        submitterEmail: "alice@example.com",
        submitterName: "Alice Martin",
      });

      vi.setSystemTime(new Date(startedAt.getTime() + 2 * 60 * 60 * 1_000 + 1));
      await t.action(internal.video.expireReservation, {
        reservationId: upload.reservationId,
      });

      const stored = await t.run(async (ctx) => ({
        asset: await ctx.db.query("videoAssets").unique(),
        reservation: await ctx.db.get(upload.reservationId),
        retry: await ctx.db.query("videoRetryLinks").unique(),
      }));
      expect(stored.asset).toMatchObject({ status: "failed" });
      expect(stored.reservation?.status).toBe("released");
      expect(stored.retry).toMatchObject({
        testimonialId: stored.asset?.testimonialId,
      });
      if (!stored.retry) throw new Error("Timeout retry link missing.");
      await t.action(internal.videoRetryDelivery.deliver, {
        retryLinkId: stored.retry._id,
      });
      await expect(
        t.run((ctx) => ctx.db.get(stored.retry!._id)),
      ).resolves.toMatchObject({ deliveryStatus: "sent" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a Ready video publishable when generated captions fail", async () => {
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "caption-failure-client",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: {
          duration: 30,
          id: "caption-asset",
          passthrough: upload.reservationId,
          playback_ids: [{ id: "caption-playback", policy: "public" }],
        },
        id: "caption-ready-event",
        type: "video.asset.ready",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: { asset_id: "caption-asset", id: "caption-track" },
        id: "caption-failed-event",
        type: "video.asset.track.errored",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });

    await expect(
      t.run((ctx) => ctx.db.query("videoAssets").unique()),
    ).resolves.toMatchObject({ captionsStatus: "failed", status: "ready" });
  });

  it("denies cross-tenant reads of private Video Testimonial metadata", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    await alice.client.mutation(api.organizations.create, {
      name: "Alice Studio",
      publicSlug: "alice-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "cross-tenant-video",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "alice-proof",
      spokenLanguage: "en",
    });
    const consent = buildPublicationConsent({
      brandName: "Alice Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "cross-tenant-video",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 45,
      reservationId: upload.reservationId,
      submitterEmail: "submitter@example.com",
      submitterName: "Alice Martin",
    });
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Owner",
    });
    const bobBrand = await bob.client.mutation(api.organizations.create, {
      name: "Bob Studio",
      publicSlug: "bob-proof",
    });

    await expect(
      bob.client.query(api.submissions.getPrivate, {
        organizationId: bobBrand.id,
        testimonialId: submitted.testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "TESTIMONIAL_UNAVAILABLE" } });
  });
});
