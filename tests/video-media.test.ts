import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingPrivateKey = Buffer.from(
  privateKey.export({ format: "pem", type: "pkcs8" }),
).toString("base64");

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
    vi.stubEnv("MUX_SIGNING_KEY_ID", "mux-signing-key-id");
    vi.stubEnv("MUX_SIGNING_PRIVATE_KEY", signingPrivateKey);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lets only a Pro Owner request the best ready MP4 up to 1080p", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "download");
    await addStripeSubscription(t, String(brand.id), "active");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: "download-asset-download",
                playback_ids: [
                  { id: "signed-playback-download", policy: "signed" },
                ],
              },
            }),
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                static_renditions: {
                  files: [
                    { name: "2160p.mp4", resolution: "2160p", status: "ready" },
                    { name: "1080p.mp4", resolution: "1080p", status: "ready" },
                  ],
                },
              },
            }),
            { status: 200 },
          ),
        ),
    );

    await expect(
      owner.client.action(api.videoMedia.requestDownload, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).resolves.toMatchObject({
      url: expect.stringMatching(
        /^https:\/\/stream\.mux\.com\/signed-playback-download\/1080p\.mp4\?token=.+&download=video-testimonial\.mp4$/,
      ),
    });
    const stored = await t.run(async (ctx) => ({
      asset: await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonialId),
        )
        .unique(),
      cleanupJobs: await ctx.db.query("videoProviderCleanupJobs").collect(),
    }));
    expect(stored.asset).toMatchObject({
      downloadPlaybackId: "signed-playback-download",
      downloadProviderAssetId: "download-asset-download",
    });
    expect(stored.cleanupJobs).toEqual([]);
  });

  it("rejects Free and cross-tenant download requests on the server", async () => {
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
      owner.client.action(api.videoMedia.requestDownload, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "PREMIUM_REQUIRED" } });
    await expect(
      outsider.client.action(api.videoMedia.requestDownload, {
        organizationId: otherBrand.id,
        testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "TESTIMONIAL_UNAVAILABLE" } });
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
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });
  });

  it("durably cleans a derived asset created after deletion already finalized", async () => {
    vi.useFakeTimers();
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const testimonialId = await createReadyVideo(t, brand.id, "late-download");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await owner.client.action(api.videoMedia.remove, {
      organizationId: brand.id,
      testimonialId,
    });

    const attached = await owner.client.mutation(
      internal.videoMedia.attachDownloadAsset,
      {
        organizationId: brand.id,
        playbackId: "late-signed-playback",
        provider: "mux",
        providerAssetId: "late-download-asset",
        testimonialId,
      },
    );
    expect(attached).toMatchObject({
      accepted: false,
      providerAssetId: "late-download-asset",
    });
    const pending = await t.run((ctx) =>
      ctx.db.query("videoProviderCleanupJobs").collect(),
    );
    expect(pending).toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );
    await t.action(internal.videoMedia.processProviderCleanup, {
      cleanupJobId: pending[0]!._id,
    });
    const afterFailure = await t.run(async (ctx) => ({
      deletion: await ctx.db.query("videoMediaDeletions").unique(),
      jobs: await ctx.db.query("videoProviderCleanupJobs").collect(),
    }));
    expect(afterFailure.deletion?.status).toBe("deleted");
    expect(afterFailure.jobs).toHaveLength(1);
    expect(afterFailure.jobs[0]?.attempts).toBe(1);

    await t.action(internal.videoMedia.processProviderCleanup, {
      cleanupJobId: pending[0]!._id,
    });
    const remaining = await t.run((ctx) =>
      ctx.db.query("videoProviderCleanupJobs").collect(),
    );
    expect(remaining).toEqual([]);
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
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      owner.client.action(api.videoMedia.remove, {
        organizationId: brand.id,
        testimonialId,
      }),
    ).rejects.toThrow("Mux asset deletion failed (503)");
    await expect(
      t.query(api.publicWall.list, {
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
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const remaining = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      consents: await ctx.db.query("publicationConsents").collect(),
      cleanupJobs: await ctx.db.query("videoProviderCleanupJobs").collect(),
      deletions: await ctx.db.query("videoMediaDeletions").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      reservations: await ctx.db.query("videoReservations").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(remaining).toEqual({
      assets: [],
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
    expect(remaining.deletions[0]).not.toHaveProperty("lastError");
    expect(remaining.deletions[0]).toMatchObject({ providerAssets: [] });
    expect(JSON.stringify(remaining.deletions)).not.toContain("private@");
    expect(JSON.stringify(remaining.deletions)).not.toContain("playback-");
  });
});
