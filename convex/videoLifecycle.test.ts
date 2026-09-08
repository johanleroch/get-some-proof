import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  authenticatedUser,
  createConvexTest,
} from "../tests/convex-test-helpers";

async function setup() {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("MUX_PROVIDER", "fake");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  await owner.client.mutation(api.organizations.create, {
    name: "Mira Films",
    publicSlug: "mira-films",
  });
  const upload = async (clientSubmissionId: string) => {
    const reservation = await t.mutation(internal.video.reserveCapacity, {
      clientSubmissionId,
      publicSlug: "mira-films",
    });
    const assetId = await t.mutation(internal.video.attachProviderUpload, {
      reservationId: reservation.reservationId,
      provider: "fake",
      providerUploadId: `upload-${clientSubmissionId}`,
      mimeType: "video/mp4",
      fileSizeBytes: 2048,
      spokenLanguage: "en",
    });
    return { ...reservation, assetId, clientSubmissionId };
  };
  return { t, upload };
}

describe("Video reservation cleanup", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("persists idempotent provider cancellation and retains late asset cleanup", async () => {
    const { t, upload } = await setup();
    const first = await upload("first-video-client");
    for (let i = 0; i < 2; i++)
      await t.mutation(api.video.cancelUpload, {
        clientSubmissionId: first.clientSubmissionId,
        reservationId: first.reservationId,
      });
    const queued = await t.run((ctx) =>
      ctx.db.query("videoProviderCleanupJobs").collect(),
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      providerUploadId: "upload-first-video-client",
    });
    await t.mutation(internal.videoWebhooks.applyEvent, {
      event: {
        id: "late-asset-fixture",
        type: "video.upload.asset_created",
        data: {
          asset_id: "late-asset",
          passthrough: first.reservationId,
        },
      },
      retryTokenHash: "fixture-hash",
      retryTokenSeed: "fixture-seed",
    });
    const jobs = await t.run((ctx) =>
      ctx.db.query("videoProviderCleanupJobs").collect(),
    );
    expect(jobs.some((job) => job.providerAssetId === "late-asset")).toBe(true);
    expect(await t.run((ctx) => ctx.db.get(first.assetId))).toMatchObject({
      status: "failed",
      providerAssetId: "late-asset",
    });
  });

  it.each(["awaiting_upload", "ready"] as const)(
    "expires an abandoned %s upload with durable cleanup",
    async (status) => {
      const { t, upload } = await setup();
      const first = await upload("expiry-video-client");
      await t.run(async (ctx) => {
        await ctx.db.patch(first.reservationId, {
          expiresAt: Date.now() - 1,
          status: status === "ready" ? "consumed" : "reserved",
        });
        await ctx.db.patch(first.assetId, {
          status,
          ...(status === "ready"
            ? { providerAssetId: "ready-abandoned-asset" }
            : {}),
        });
      });
      await t.action(internal.video.expireReservation, {
        reservationId: first.reservationId,
      });
      expect(await t.run((ctx) => ctx.db.get(first.assetId))).toMatchObject({
        status: "failed",
      });
      expect(
        await t.run((ctx) =>
          ctx.db.query("videoProviderCleanupJobs").collect(),
        ),
      ).toHaveLength(1);
    },
  );

  it("keeps pending provider cleanup inside the Brand capacity bound", async () => {
    const { t, upload } = await setup();
    for (const client of ["capacity-video-one", "capacity-video-two"]) {
      const first = await upload(client);
      await t.mutation(api.video.cancelUpload, {
        clientSubmissionId: client,
        reservationId: first.reservationId,
      });
    }
    await expect(upload("capacity-video-three")).rejects.toThrow(
      "VIDEO_CAPACITY_REACHED",
    );
    const job = await t.run((ctx) =>
      ctx.db.query("videoProviderCleanupJobs").first(),
    );
    await t.action(internal.videoMedia.processProviderCleanup, {
      cleanupJobId: job!._id,
    });
    await expect(upload("capacity-video-three")).resolves.toHaveProperty(
      "assetId",
    );
  });
});
