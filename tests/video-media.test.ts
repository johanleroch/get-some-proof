import { beforeEach as beforeWallTest } from "vitest";
beforeWallTest(() => {
  process.env.PUBLIC_READ_RATE_LIMIT_SECRET =
    "wall-service-test-credential-32-characters";
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

async function createReadyVideo(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
  suffix: string,
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      clientSubmissionId: `video-${suffix}`,
      createdAt: now,
      managementTokenHash: suffix.padEnd(64, "a").slice(0, 64),
      moderationStatus: "published",
      organizationId,
      submissionType: "video",
      submitterEmail: "private@example.invalid",
      submitterName: "Camille Test",
      text: "",
      updatedAt: now,
    });
    await ctx.db.insert("publicationConsents", {
      acceptedAt: now,
      brandName: "Acme Studio",
      consentText: "Approved consent",
      consentVersion: "v1",
      identityFields: ["name"],
      organizationId,
      testimonialId,
    });
    const reservationId = await ctx.db.insert("videoReservations", {
      clientSubmissionId: `video-${suffix}`,
      createdAt: now,
      expiresAt: now + 60_000,
      organizationId,
      plan: "premium",
      providerUploadId: `upload-${suffix}`,
      status: "consumed",
      updatedAt: now,
    });
    await ctx.db.insert("videoAssets", {
      captionsStatus: "ready",
      createdAt: now,
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      organizationId,
      playbackId: `playback-${suffix}`,
      provider: "mux",
      providerAssetId: `asset-${suffix}`,
      providerUploadId: `upload-${suffix}`,
      reservationId,
      spokenLanguage: "fr",
      status: "ready",
      testimonialId,
      updatedAt: now,
    });
    await ctx.db.insert("publicTestimonialProjections", {
      captionsAvailable: true,
      name: "Camille Test",
      organizationId,
      playbackId: `playback-${suffix}`,
      publicOrderKey: "V",
      publishedAt: now,
      testimonialId,
      type: "video",
    });
    return testimonialId;
  });
}

describe("Video media ownership", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_video_media");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_video_media");
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects cross-tenant video deletion", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const outsider = await authenticatedUser(t, {
      email: "outsider@example.invalid",
      name: "Outsider",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const otherBrand = await outsider.client.mutation(
      api.organizations.create,
      {
        name: "Other Studio",
        publicSlug: "other-proof",
      },
    );
    const testimonialId = await createReadyVideo(t, brand.id, "protected");

    await expect(
      outsider.client.action(api.videoMedia.remove, {
        organizationId: otherBrand.id,
        testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "TESTIMONIAL_UNAVAILABLE" } });
    await expect(
      t.run((ctx) => ctx.db.get(testimonialId)),
    ).resolves.not.toBeNull();
  });

  it("rejects video deletion through the legacy text-only mutation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "legacy-delete");

    await expect(
      owner.client.mutation(api.testimonialModeration.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).rejects.toMatchObject({
      data: { code: "VIDEO_DELETION_REQUIRES_MEDIA_ACTION" },
    });
    await expect(
      t.run((ctx) => ctx.db.get(testimonialId)),
    ).resolves.not.toBeNull();
  });

  it("blocks a retry replacement atomically after video deletion starts", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "delete-race");
    const race = await t.run(async (ctx) => {
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique();
      if (!asset) throw new Error("Expected video asset");
      const now = Date.now();
      await ctx.db.patch(asset._id, {
        captionsStatus: "failed",
        failureReason: "Processing failed.",
        status: "failed",
      });
      const retryLinkId = await ctx.db.insert("videoRetryLinks", {
        createdAt: now,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        testimonialId,
        tokenHash: "delete-race".padEnd(64, "a"),
        videoAssetId: asset._id,
      });
      const reservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: "delete-race-replacement",
        createdAt: now,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        plan: "premium",
        status: "reserved",
        updatedAt: now,
      });
      await ctx.db.patch(retryLinkId, {
        replacementReservationId: reservationId,
        usedAt: now,
      });
      return { assetId: asset._id, reservationId };
    });

    await owner.client.mutation(internal.videoMedia.prepareRemoval, {
      organizationId: brand.id,
      testimonialId,
    });

    await expect(
      t.mutation(internal.video.attachRetryProviderUpload, {
        failedVideoAssetId: race.assetId,
        fileSizeBytes: 4_096,
        mimeType: "video/mp4",
        provider: "mux",
        providerUploadId: "late-provider-upload",
        reservationId: race.reservationId,
        spokenLanguage: "fr",
        testimonialId,
        tokenHash: "delete-race".padEnd(64, "a"),
      }),
    ).rejects.toMatchObject({ data: { code: "VIDEO_RETRY_UNAVAILABLE" } });
    const assets = await t.run((ctx) => ctx.db.query("videoAssets").collect());
    expect(assets).toHaveLength(1);
    expect(assets[0]?.providerUploadId).not.toBe("late-provider-upload");
  });

  it("prevents republication after permanent video deletion starts", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "delete-publish");
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "archived",
      testimonialId,
    });
    await owner.client.mutation(internal.videoMedia.prepareRemoval, {
      organizationId: brand.id,
      testimonialId,
    });

    await expect(
      owner.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: brand.id,
        status: "published",
        testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "VIDEO_DELETION_IN_PROGRESS" } });
    await expect(
      t.query(api.publicWall.list, {
        secret: "wall-service-test-credential-32-characters",
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });
  });

  it("cancels an unfinished Direct Upload before deleting application state", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(
      t,
      brand.id,
      "processing-delete",
    );
    await t.run(async (ctx) => {
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique();
      if (!asset) throw new Error("Expected video asset");
      await ctx.db.patch(asset._id, {
        captionsStatus: "requested",
        playbackId: undefined,
        providerAssetId: undefined,
        status: "processing",
      });
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).resolves.toEqual({ deleted: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/uploads/upload-processing-delete/cancel",
      expect.objectContaining({ method: "PUT" }),
    );
    await expect(t.run((ctx) => ctx.db.get(testimonialId))).resolves.toBeNull();
  });

  it("invalidates public playback immediately, retries provider failure, and deletes every app copy", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "delete");
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "archived",
      testimonialId,
    });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId,
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      const primaryAsset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique();
      if (!primaryAsset) throw new Error("Expected primary video asset");
      await ctx.db.patch(primaryAsset._id, {
        downloadPlaybackId: "signed-download-delete",
        downloadProviderAssetId: "download-asset-delete",
      });
      const reservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: "failed-original",
        createdAt: now,
        expiresAt: now,
        organizationId: brand.id,
        plan: "premium",
        providerUploadId: "failed-upload",
        status: "released",
        updatedAt: now,
      });
      const oldAssetId = await ctx.db.insert("videoAssets", {
        captionsStatus: "failed",
        createdAt: now,
        fileSizeBytes: 1_024,
        mimeType: "video/mp4",
        organizationId: brand.id,
        provider: "mux",
        providerAssetId: "failed-original-asset",
        providerUploadId: "failed-upload",
        reservationId,
        spokenLanguage: "fr",
        status: "failed",
        updatedAt: now,
      });
      await ctx.db.insert("videoRetryLinks", {
        createdAt: now,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        testimonialId,
        tokenHash: "retry".padEnd(64, "a"),
        videoAssetId: oldAssetId,
      });
      const olderReservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: "failed-older",
        createdAt: now - 1,
        expiresAt: now,
        organizationId: brand.id,
        plan: "premium",
        providerUploadId: "failed-older-upload",
        status: "released",
        updatedAt: now,
      });
      const olderAssetId = await ctx.db.insert("videoAssets", {
        captionsStatus: "failed",
        createdAt: now - 1,
        fileSizeBytes: 1_024,
        mimeType: "video/mp4",
        organizationId: brand.id,
        provider: "mux",
        providerAssetId: "failed-older-asset",
        providerUploadId: "failed-older-upload",
        reservationId: olderReservationId,
        spokenLanguage: "fr",
        status: "failed",
        updatedAt: now,
      });
      await ctx.db.insert("videoRetryLinks", {
        createdAt: now - 1,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        testimonialId,
        tokenHash: "older-retry".padEnd(64, "a"),
        videoAssetId: olderAssetId,
      });
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).rejects.toThrow("Mux asset deletion failed (503)");
    await expect(
      t.query(api.publicWall.list, {
        secret: "wall-service-test-credential-32-characters",
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });

    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).resolves.toEqual({ deleted: true });
    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).resolves.toEqual({ deleted: true });
    await t.finishInProgressScheduledFunctions();
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/assets/failed-original-asset",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/assets/failed-older-asset",
      expect.objectContaining({ method: "DELETE" }),
    );

    const remaining = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", brand.id)
            .eq("targetType", "testimonial")
            .eq("targetId", String(testimonialId)),
        )
        .collect(),
      consents: await ctx.db.query("publicationConsents").collect(),
      cleanupJobs: await ctx.db.query("videoProviderCleanupJobs").collect(),
      deletions: await ctx.db.query("videoMediaDeletions").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      reservations: await ctx.db.query("videoReservations").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(remaining).toEqual({
      assets: [],
      audits: expect.arrayContaining([
        expect.objectContaining({
          eventType: "testimonial.deleted",
          targetLabel: "Deleted Testimonial",
        }),
      ]),
      cleanupJobs: [],
      consents: [],
      deletions: [
        expect.objectContaining({
          attempts: 2,
          providerUploads: [],
          status: "deleted",
        }),
      ],
      projections: [],
      reservations: [],
      testimonials: [],
    });
    expect(remaining.audits.map((event) => event.targetLabel)).not.toContain(
      "Camille Test",
    );
    expect(remaining.audits).toHaveLength(1);
    expect(remaining.deletions[0]).not.toHaveProperty("lastError");
    expect(remaining.deletions[0]).toMatchObject({ providerAssets: [] });
    expect(JSON.stringify(remaining.deletions)).not.toContain("private@");
    expect(JSON.stringify(remaining.deletions)).not.toContain("playback-");
  });
});
