import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { deleteTestimonialRecords } from "@convex/testimonialDeletion";
import { getVideoStorageAvailability } from "@convex/collectionQuotas";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function copyFixture() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = (await ctx.db.get(project.id))!.accountId;
    const jobId = await ctx.db.insert("testimonialImportJobs", {
      organizationId: project.id,
      createdBy: "fixture-owner",
      provider: "senja",
      sourceUrl: "https://love.senja.io/",
      itemCount: 1,
      createdAt: now,
      expiresAt: now + 86400000,
    });
    const testimonialId = await ctx.db.insert("testimonials", {
      organizationId: project.id,
      clientSubmissionId: "copy",
      submissionType: "video",
      moderationStatus: "pending",
      submitterName: "Camille Laurent",
      text: "",
      createdAt: now,
      updatedAt: now,
    });
    const itemId = await ctx.db.insert("testimonialImportItems", {
      jobId,
      organizationId: project.id,
      position: 0,
      sourceId: "copy",
      type: "video",
      authorName: "Camille Laurent",
      text: "",
      videoUrl: "https://stream.mux.com/source123/high.mp4",
      testimonialId,
      videoStatus: "processing",
    });
    const reservationId = await ctx.db.insert("videoReservations", {
      accountId,
      organizationId: project.id,
      importItemId: itemId,
      clientSubmissionId: "copy",
      plan: "free",
      status: "reserved",
      expiresAt: now + 7200000,
      createdAt: now,
      updatedAt: now,
    });
    const assetId = await ctx.db.insert("videoAssets", {
      accountId,
      organizationId: project.id,
      reservationId,
      testimonialId,
      importItemId: itemId,
      provider: "mux",
      status: "processing",
      mimeType: "video/mp4",
      captionsStatus: "requested",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(itemId, { videoAssetId: assetId });
    return { assetId, reservationId, testimonialId, accountId };
  });
  return { t, project, ...ids };
}

it("cleans up a late copy after its testimonial, reservation and Project have been deleted", async () => {
  const { t, project, assetId, reservationId, testimonialId, accountId } =
    await copyFixture();
  expect(
    await t.mutation(internal.testimonialImportVideo.getCopyContext, {
      assetId,
    }),
  ).toMatchObject({ provider: "mux" });
  await t.run(async (ctx) =>
    deleteTestimonialRecords(ctx, (await ctx.db.get(testimonialId))!),
  );
  expect(await t.run((ctx) => ctx.db.get(assetId))).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(reservationId))).toBeNull();
  expect(
    await t.run((ctx) => getVideoStorageAvailability(ctx, project.id)),
  ).toMatchObject({ used: 1 });
  await t.run((ctx) => ctx.db.delete(project.id));
  const event = {
    id: "late-copy",
    type: "video.asset.ready",
    data: {
      id: "late-mux-asset",
      passthrough: reservationId,
      duration: 20,
      playback_ids: [{ id: "late-playback", policy: "public" }],
    },
  };
  expect(
    await t.mutation(internal.videoWebhooks.applyEvent, {
      event,
      retryTokenHash: "unused",
      retryTokenSeed: "unused",
    }),
  ).toEqual({ outcome: "released" });
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: { ...event, id: "late-copy-repeat" },
    retryTokenHash: "unused",
    retryTokenSeed: "unused",
  });
  const jobs = await t.run((ctx) =>
    ctx.db.query("videoProviderCleanupJobs").collect(),
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    providerAssetId: "late-mux-asset",
    accountId,
  });
  expect(
    await t.run((ctx) => ctx.db.query("videoImportCleanupIntents").collect()),
  ).toEqual([]);
});

it("does not hold capacity when deletion precedes the copy or a definite rejection arrives", async () => {
  const first = await copyFixture();
  await first.t.run(async (ctx) =>
    deleteTestimonialRecords(ctx, (await ctx.db.get(first.testimonialId))!),
  );
  expect(
    await first.t.run((ctx) =>
      ctx.db.query("videoImportCleanupIntents").collect(),
    ),
  ).toEqual([]);
  const second = await copyFixture();
  await second.t.mutation(internal.testimonialImportVideo.getCopyContext, {
    assetId: second.assetId,
  });
  await second.t.run(async (ctx) =>
    deleteTestimonialRecords(ctx, (await ctx.db.get(second.testimonialId))!),
  );
  await second.t.mutation(internal.testimonialImportVideo.rejectCopy, {
    assetId: second.assetId,
    reason: "Source unavailable",
  });
  expect(
    await second.t.run((ctx) =>
      getVideoStorageAvailability(ctx, second.project.id),
    ),
  ).toMatchObject({ used: 0 });
});

it("starts a copy at most once and refuses an expired reservation", async () => {
  const first = await copyFixture();
  expect(
    await first.t.mutation(internal.testimonialImportVideo.getCopyContext, {
      assetId: first.assetId,
    }),
  ).not.toBeNull();
  expect(
    await first.t.mutation(internal.testimonialImportVideo.getCopyContext, {
      assetId: first.assetId,
    }),
  ).toBeNull();
  const second = await copyFixture();
  await second.t.run((ctx) =>
    ctx.db.patch(second.reservationId, { expiresAt: Date.now() - 1 }),
  );
  expect(
    await second.t.mutation(internal.testimonialImportVideo.getCopyContext, {
      assetId: second.assetId,
    }),
  ).toBeNull();
});

it("retains an asset that changed after the workspace media snapshot", async () => {
  const { t, project, assetId } = await copyFixture();
  await t.mutation(internal.testimonialImportVideo.getCopyContext, { assetId });
  const deletionId = await t.run((ctx) =>
    ctx.db.insert("workspaceDeletions", {
      organizationId: project.id,
      actorUserId: "fixture-owner",
      status: "requested",
      phase: "media",
      attempts: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const snapshot = await t.query(internal.workspaceDeletion.readMediaBatch, {
    deletionId,
  });
  expect(snapshot[0]!.providerAssetIds).toEqual([]);
  // Mux answers after the deletion action has read its list of external targets.
  await t.run((ctx) =>
    ctx.db.patch(assetId, { providerAssetId: "arrived-during-deletion" }),
  );
  await t.mutation(internal.workspaceDeletion.completeMediaBatch, {
    deletionId,
    targets: snapshot,
  });
  expect(await t.run((ctx) => ctx.db.get(assetId))).toMatchObject({
    providerAssetId: "arrived-during-deletion",
  });
  const next = await t.query(internal.workspaceDeletion.readMediaBatch, {
    deletionId,
  });
  expect(next[0]!.providerAssetIds).toEqual(["arrived-during-deletion"]);
  await t.mutation(internal.workspaceDeletion.completeMediaBatch, {
    deletionId,
    targets: next,
  });
  expect(await t.run((ctx) => ctx.db.get(assetId))).toBeNull();
});

it("finds an orphan on a later inventory page and holds capacity until provider deletion succeeds", async () => {
  const { t, project, assetId, testimonialId, reservationId } =
    await copyFixture();
  await t.mutation(internal.testimonialImportVideo.getCopyContext, { assetId });
  await t.run(async (ctx) =>
    deleteTestimonialRecords(ctx, (await ctx.db.get(testimonialId))!),
  );
  vi.stubEnv("MUX_TOKEN_ID", "fixture-id");
  vi.stubEnv("MUX_TOKEN_SECRET", "fixture-secret");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: "other-asset", passthrough: "other-reservation" }],
          next_cursor: "page-two",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: "orphan-asset", passthrough: reservationId }],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await t.mutation(internal.videoImportCleanup.reconcileDue, {})).toBe(
    1,
  );
  const intent = await t.run((ctx) =>
    ctx.db.query("videoImportCleanupIntents").unique(),
  );
  await t.action(internal.videoImportCleanup.probeInventory, {
    intentId: intent!._id,
    probe: 1,
  });
  expect(await t.run((ctx) => ctx.db.get(intent!._id))).toMatchObject({
    cursor: "page-two",
  });
  expect(
    await t.run((ctx) => getVideoStorageAvailability(ctx, project.id)),
  ).toMatchObject({ used: 1 });
  vi.setSystemTime(Date.now() + 1001);
  await t.mutation(internal.videoImportCleanup.reconcileDue, {});
  await t.action(internal.videoImportCleanup.probeInventory, {
    intentId: intent!._id,
    probe: 2,
  });
  expect(await t.run((ctx) => ctx.db.get(intent!._id))).toBeNull();
  const cleanup = await t.run((ctx) =>
    ctx.db.query("videoProviderCleanupJobs").unique(),
  );
  expect(cleanup).toMatchObject({ providerAssetId: "orphan-asset" });
  expect(
    await t.run((ctx) => getVideoStorageAvailability(ctx, project.id)),
  ).toMatchObject({ used: 1 });
  await t.action(internal.videoMedia.processProviderCleanup, {
    cleanupJobId: cleanup!._id,
  });
  expect(
    await t.run((ctx) => getVideoStorageAvailability(ctx, project.id)),
  ).toMatchObject({ used: 0 });
  expect(String(fetchMock.mock.calls[2][0])).toContain("/assets/orphan-asset");
});

it("recovers expired leases, ignores stale workers and keeps empty scans unresolved", async () => {
  const { t, project, assetId, testimonialId, reservationId } =
    await copyFixture();
  await t.mutation(internal.testimonialImportVideo.getCopyContext, { assetId });
  await t.run(async (ctx) =>
    deleteTestimonialRecords(ctx, (await ctx.db.get(testimonialId))!),
  );
  // Rows created before reconciliation had no due-time field.
  await t.run(async (ctx) => {
    const legacy = await ctx.db.query("videoImportCleanupIntents").unique();
    await ctx.db.patch(legacy!._id, { nextAttemptAt: undefined });
  });
  await t.mutation(internal.videoImportCleanup.reconcileDue, {});
  const intent = await t.run((ctx) =>
    ctx.db.query("videoImportCleanupIntents").unique(),
  );
  expect(await t.mutation(internal.videoImportCleanup.reconcileDue, {})).toBe(
    0,
  );
  vi.setSystemTime(Date.now() + 120001);
  expect(await t.mutation(internal.videoImportCleanup.reconcileDue, {})).toBe(
    1,
  );
  await t.mutation(internal.videoImportCleanup.finishProbe, {
    intentId: intent!._id,
    probe: 1,
    matches: [{ id: "stale-result", passthrough: reservationId }],
    nextCursor: null,
    failed: false,
  });
  expect(await t.run((ctx) => ctx.db.get(intent!._id))).not.toBeNull();
  await expect(
    t.mutation(internal.videoImportCleanup.finishProbe, {
      intentId: intent!._id,
      probe: 2,
      matches: [{ id: "foreign-asset", passthrough: "foreign-reservation" }],
      nextCursor: null,
      failed: false,
    }),
  ).rejects.toThrow();
  for (let probe = 2; probe <= 4; probe++) {
    await t.mutation(internal.videoImportCleanup.finishProbe, {
      intentId: intent!._id,
      probe,
      matches: [],
      nextCursor: null,
      failed: false,
    });
    const current = await t.run((ctx) => ctx.db.get(intent!._id));
    if (probe < 4) {
      vi.setSystemTime(current!.nextAttemptAt! + 1);
      await t.mutation(internal.videoImportCleanup.reconcileDue, {});
    }
  }
  expect(await t.run((ctx) => ctx.db.get(intent!._id))).toMatchObject({
    completedScans: 3,
    reviewRequiredAt: expect.any(Number),
  });
  expect(
    await t.run((ctx) => getVideoStorageAvailability(ctx, project.id)),
  ).toMatchObject({ used: 1 });
});
