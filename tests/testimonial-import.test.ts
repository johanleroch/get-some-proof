import { withTestimonialIds } from "./testimonial-source-fixture";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, components, internal } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "./convex-test-helpers";

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv(
    "PUBLIC_READ_RATE_LIMIT_SECRET",
    "wall-import-test-secret-32-characters-long",
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("refuses a text confirmation when its Project becomes inactive after eligibility", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_import_eligibility");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_import_eligibility");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const first = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  await addStripeSubscription(t, first.id, "active");
  const second = await owner.client.mutation(api.organizations.create, {
    name: "Willow Classes",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            '<article class="testimonial-card text-testimonial"><span class="font-bold">Camille Roche</span><div class="show-more-text">A lovely pottery class.</div></article>',
          ),
        ),
    ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: second.id,
      url: "https://testimonial.to/willow-classes/all",
    },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const selection = {
    jobId,
    itemIds: preview!.items.page.map((item) => item._id),
  };
  expect(
    await owner.client.query(api.importEligibility.selection, selection),
  ).toMatchObject({ text: 1 });
  await addStripeSubscription(t, first.id, "canceled", {
    eventCreated: Math.floor(Date.now() / 1000) + 1,
  });
  expect(
    await owner.client.query(api.importEligibility.selection, selection),
  ).toMatchObject({ text: 0, unavailable: 1 });
  await expect(
    owner.client.mutation(api.testimonialImports.confirm, selection),
  ).rejects.toMatchObject({ data: { code: "PROJECT_INACTIVE" } });
  expect(await t.run((ctx) => ctx.db.query("testimonials").collect())).toEqual(
    [],
  );
});

it("corrects imported identity for its Owner while preserving source words and duplicate matching", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const other = await authenticatedUser(t, { email: "outsider@example.com" });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            '<article class="testimonial-card text-testimonial"><span class="font-bold">Camille</span><div class="show-more-text">Exactly my words.</div></article>',
          ),
        ),
    ),
  );
  const source = {
    organizationId: project.id,
    url: "https://testimonial.to/atelier-june/all",
  };
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    source,
  );
  const query = { jobId, paginationOpts: { cursor: null, numItems: 100 } };
  const item = (await owner.client.query(
    api.testimonialImports.getPreview,
    query,
  ))!.items.page[0]!;
  const correction = {
    itemId: item._id,
    authorName: " Camille Laurent ",
    tagline: "Owner, Atelier June",
  };
  await expect(
    other.client.mutation(api.testimonialImports.correctIdentity, correction),
  ).rejects.toThrow();
  await expect(
    owner.client.mutation(api.testimonialImports.correctIdentity, {
      ...correction,
      authorName: " ",
    }),
  ).rejects.toMatchObject({ data: { code: "INVALID_IMPORT_IDENTITY" } });
  await owner.client.mutation(
    api.testimonialImports.correctIdentity,
    correction,
  );
  const updated = (await owner.client.query(
    api.testimonialImports.getPreview,
    query,
  ))!.items.page[0]!;
  expect(updated).toMatchObject({
    authorName: "Camille",
    text: "Exactly my words.",
    identityCorrection: { authorName: "Camille Laurent" },
  });
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: [item._id],
  });
  const saved = await t.run((ctx) =>
    ctx.db
      .query("testimonials")
      .withIndex("by_organization_created_at", (q) =>
        q.eq("organizationId", project.id),
      )
      .first(),
  );
  expect(saved).toMatchObject({
    submitterName: "Camille Laurent",
    role: "Owner, Atelier June",
    text: "Exactly my words.",
    importOrigin: {
      originalAuthorName: "Camille",
      originalText: "Exactly my words.",
    },
  });
  await expect(
    owner.client.mutation(api.testimonialImports.correctIdentity, correction),
  ).rejects.toMatchObject({ data: { code: "IMPORT_ALREADY_PROCESSED" } });
  const legacyId = `text:${createHash("sha256")
    .update(JSON.stringify(["Camille", "Exactly my words."]))
    .digest("hex")}`;
  const legacyOrigin = { ...saved!.importOrigin!, sourceId: legacyId };
  await t.run((ctx) =>
    ctx.db.patch(saved!._id, {
      importSourceKey: JSON.stringify(["testimonial-to", source.url, legacyId]),
      importOrigin: legacyOrigin,
    }),
  );
  const unchangedFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            '<article class="testimonial-card text-testimonial"><span class="font-bold">Camille Moreau</span><div class="show-more-text">Changed before identity migration.</div></article>',
          ),
        ),
    ),
  );
  await expect(
    owner.client.action(api.testimonialImportSource.preview, source),
  ).rejects.toMatchObject({ data: { code: "LEGACY_IMPORT_REVIEW_REQUIRED" } });
  vi.stubGlobal("fetch", unchangedFetch);
  const repeat = await owner.client.action(
    api.testimonialImportSource.preview,
    source,
  );
  expect(
    (await owner.client.query(api.testimonialImports.getPreview, {
      ...query,
      jobId: repeat.jobId,
    }))!.items.page[0]!.sourceState,
  ).toBe("already_imported");
  const reconciled = await t.run((ctx) => ctx.db.get(saved!._id));
  expect(reconciled!.importSourceKey).toBe(
    JSON.stringify(["testimonial-to", source.url, "proof-0"]),
  );
  expect(reconciled!.importOrigin).toEqual(legacyOrigin);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            '<article class="testimonial-card text-testimonial"><span class="font-bold">Camille Moreau</span><div class="show-more-text">Updated at the source.</div></article>',
          ),
        ),
    ),
  );
  const changedJob = await owner.client.action(
    api.testimonialImportSource.preview,
    source,
  );
  const changedItem = (await owner.client.query(
    api.testimonialImports.getPreview,
    { ...query, jobId: changedJob.jobId },
  ))!.items.page[0]!;
  expect(changedItem.sourceState).toBe("changed");
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId: changedJob.jobId,
      itemIds: [changedItem._id],
    }),
  ).toMatchObject({ changed: 1, imported: 0, skipped: 0 });
  const oldPreview = await owner.client.action(
    api.testimonialImportSource.preview,
    source,
  );
  const oldItem = (await owner.client.query(api.testimonialImports.getPreview, {
    ...query,
    jobId: oldPreview.jobId,
  }))!.items.page[0]!;
  await t.run((ctx) => ctx.db.patch(oldItem._id, { sourceId: legacyId }));
  await expect(
    owner.client.mutation(api.testimonialImports.confirm, {
      jobId: oldPreview.jobId,
      itemIds: [oldItem._id],
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_SOURCE_CHANGED" } });
  expect(await t.run((ctx) => ctx.db.get(saved!._id))).toEqual(reconciled);
});

it("flags a replaced source video or format while retaining the imported snapshot", async () => {
  vi.useFakeTimers();
  vi.stubEnv("MUX_PROVIDER", "fake");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  let playback = "originalPlayback";
  let rendition = "high.mp4";
  let type = "video";
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          `<script>start({reviews:${JSON.stringify([
            {
              id: "stable-proof-id",
              type,
              text: "The original customer words.",
              customer: { name: "Lina Moreau" },
              media_asset: {
                metadata: {
                  playback_ids: [{ id: playback, policy: "public" }],
                  static_renditions: {
                    status: "ready",
                    files: [{ name: rendition, ext: "mp4" }],
                  },
                },
              },
            },
          ])}})</script>`,
        ),
    ),
  );
  async function preview() {
    const { jobId } = await owner.client.action(
      api.testimonialImportSource.preview,
      {
        organizationId: project.id,
        url: "https://love.senja.io/",
      },
    );
    const data = await owner.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    });
    return { jobId, item: data!.items.page[0]! };
  }
  const initial = await preview();
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId: initial.jobId,
    itemIds: [initial.item._id],
  });
  rendition = "medium.mp4";
  const sameVideo = await preview();
  expect(sameVideo.item.sourceState).toBe("already_imported");
  playback = "replacementPlayback";
  const replacement = await preview();
  expect(replacement.item.sourceState).toBe("changed");
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId: replacement.jobId,
      itemIds: [replacement.item._id],
    }),
  ).toMatchObject({ changed: 1, skipped: 0, imported: 0 });
  type = "text";
  const changedFormat = await preview();
  expect(changedFormat.item.sourceState).toBe("changed");
  const stored = await t.run((ctx) =>
    ctx.db
      .query("testimonials")
      .withIndex("by_organization_created_at", (q) =>
        q.eq("organizationId", project.id),
      )
      .collect(),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].importOrigin).toMatchObject({
    originalType: "video",
    originalVideoUrl: "https://stream.mux.com/originalPlayback/high.mp4",
  });
  await t.run(async (ctx) => {
    const legacy = { ...stored[0].importOrigin! };
    delete legacy.originalType;
    delete legacy.originalVideoUrl;
    await ctx.db.patch(stored[0]._id, { importOrigin: legacy });
  });
  type = "video";
  playback = "originalPlayback";
  expect((await preview()).item.sourceState).toBe("changed");
});

it("reserves shared video storage, keeps text independent and records partial media results", async () => {
  vi.useFakeTimers();
  vi.stubEnv("MUX_PROVIDER", "fake");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const reviews = [
    {
      id: "quote",
      type: "text",
      text: "Keep these words.",
      customer: { name: "Lina Moreau" },
    },
    ...[1, 2, 3].map((id) => ({
      id: `video-${id}`,
      type: "video",
      text: "",
      customer: { name: `Client ${id}` },
      media_asset: {
        metadata: {
          playback_ids: [{ id: `publicPlayback${id}`, policy: "public" }],
          static_renditions: {
            status: "ready",
            files: [{ name: "high.mp4", ext: "mp4" }],
          },
        },
      },
    })),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          `<script>start({reviews:${JSON.stringify(reviews)}})</script>`,
        ),
    ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    { organizationId: project.id, url: "https://love.senja.io/" },
  );
  const args = { jobId, paginationOpts: { cursor: null, numItems: 100 } };
  const preview = await owner.client.query(
    api.testimonialImports.getPreview,
    args,
  );
  const selection = {
    jobId,
    itemIds: preview!.items.page.map((item) => item._id),
  };
  await owner.client.mutation(api.testimonialImports.setSelection, selection);
  const textPage = await owner.client.query(api.testimonialImports.getPreview, {
    ...args,
    type: "text",
  });
  expect(textPage!.items.page.map((item) => item.type)).toEqual(["text"]);
  const firstVideoPage = await owner.client.query(
    api.testimonialImports.getPreview,
    { ...args, type: "video", paginationOpts: { cursor: null, numItems: 1 } },
  );
  expect(firstVideoPage!.items.page).toHaveLength(1);
  expect(firstVideoPage!.items.page[0]!.type).toBe("video");
  expect(firstVideoPage!.items.isDone).toBe(false);
  const secondVideoPage = await owner.client.query(
    api.testimonialImports.getPreview,
    {
      ...args,
      type: "video",
      paginationOpts: {
        cursor: firstVideoPage!.items.continueCursor,
        numItems: 1,
      },
    },
  );
  expect(secondVideoPage!.items.page[0]!._id).not.toBe(
    firstVideoPage!.items.page[0]!._id,
  );
  expect(secondVideoPage!.selectedItemIds).toEqual(selection.itemIds);
  const review = await owner.client.query(
    api.importEligibility.selection,
    selection,
  );
  expect(review).toMatchObject({
    selected: 4,
    text: 1,
    video: 2,
    videoCapacityExceeded: 1,
  });
  await expect(
    owner.client.mutation(api.testimonialImports.confirm, selection),
  ).rejects.toMatchObject({ data: { code: "VIDEO_CAPACITY_REACHED" } });
  expect(await t.run((ctx) => ctx.db.query("testimonials").collect())).toEqual(
    [],
  );
  expect(
    await t.run((ctx) => ctx.db.query("videoReservations").collect()),
  ).toEqual([]);
  selection.itemIds = selection.itemIds.filter((id) =>
    review.eligibleKeys.includes(id),
  );
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, selection),
  ).toEqual({
    imported: 1,
    skipped: 0,
    changed: 0,
    unavailable: 0,
    processing: 2,
  });
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, selection),
  ).toEqual({
    imported: 1,
    skipped: 0,
    changed: 0,
    unavailable: 0,
    processing: 2,
  });
  const queued = await owner.client.query(
    api.testimonialImports.getPreview,
    args,
  );
  for (let tick = 0; tick < 10; tick++) {
    await vi.advanceTimersByTimeAsync(1000);
    await t.finishInProgressScheduledFunctions();
    const running = await t.run((ctx) =>
      ctx.db
        .query("videoAssets")
        .withIndex("by_organization", (q) => q.eq("organizationId", project.id))
        .take(3),
    );
    if (running.length === 2 && running.every((asset) => asset.providerAssetId))
      break;
  }
  const assets = await t.run(async (ctx) =>
    Promise.all(
      queued!.items.page
        .filter((item) => item.videoAssetId)
        .map((item) => ctx.db.get(item.videoAssetId!)),
    ),
  );
  expect(assets).toHaveLength(2);
  expect(
    assets.every((asset) => asset?.providerAssetId?.startsWith("fake-import-")),
  ).toBe(true);
  const first = assets[0]!;
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: {
      id: "import-ready",
      type: "video.asset.ready",
      data: {
        id: first.providerAssetId,
        passthrough: first.reservationId,
        duration: 35,
        playback_ids: [{ id: "owned-playback", policy: "public" }],
      },
    },
    retryTokenHash: "unused",
    retryTokenSeed: "unused",
  });
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: {
      id: "import-failed",
      type: "video.asset.errored",
      data: {
        id: assets[1]!.providerAssetId,
        passthrough: assets[1]!.reservationId,
      },
    },
    retryTokenHash: "unused",
    retryTokenSeed: "unused",
  });
  const result = await owner.client.query(
    api.testimonialImports.getPreview,
    args,
  );
  expect(result!.result).toEqual({
    imported: 2,
    skipped: 0,
    changed: 0,
    unavailable: 0,
    processing: 0,
    failed: 1,
  });
  const account = await owner.client.query(api.accounts.getMine, {});
  expect(account?.usage.freeVideoUsed).toBe(0);
  expect(
    await t.run((ctx) => ctx.db.query("videoRetryLinks").collect()),
  ).toEqual([]);
  const failedItem = result!.items.page.find(
    (item) => item.videoStatus === "failed",
  )!;
  await expect(
    owner.client.mutation(api.testimonialImportVideo.retry, {
      itemId: failedItem._id,
    }),
  ).rejects.toMatchObject({ data: { code: "VIDEO_CAPACITY_REACHED" } });
  for (let tick = 0; tick < 5; tick++) {
    await vi.advanceTimersByTimeAsync(1000);
    await t.finishInProgressScheduledFunctions();
  }
  await owner.client.mutation(api.testimonialImportVideo.retry, {
    itemId: failedItem._id,
  });
  await owner.client.mutation(api.testimonialImportVideo.retry, {
    itemId: failedItem._id,
  });
  const retried = await owner.client.query(
    api.testimonialImports.getPreview,
    args,
  );
  const retryItem = retried!.items.page.find(
    (item) => item._id === failedItem._id,
  )!;
  expect(retryItem.testimonialId).toBe(failedItem.testimonialId);
  expect(retryItem.videoAssetId).not.toBe(failedItem.videoAssetId);
  expect(retried!.result).toMatchObject({
    imported: 2,
    failed: 0,
    processing: 1,
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("testimonials")
        .withIndex("by_organization_created_at", (q) =>
          q.eq("organizationId", project.id),
        )
        .take(10),
    ),
  ).toHaveLength(3);
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: {
      id: "old-attempt-late-ready",
      type: "video.asset.ready",
      data: {
        id: assets[1]!.providerAssetId,
        passthrough: assets[1]!.reservationId,
        duration: 35,
        playback_ids: [{ id: "late-playback", policy: "public" }],
      },
    },
    retryTokenHash: "unused",
    retryTokenSeed: "unused",
  });
  expect(
    (await owner.client.query(api.testimonialImports.getPreview, args))!.result,
  ).toMatchObject({ processing: 1, failed: 0, imported: 2 });
});

it("returns a recoverable empty preview for an invalid or expired unsaved job", async () => {
  vi.useFakeTimers();
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  await expect(
    owner.client.query(api.testimonialImports.getPreview, {
      jobId: "not-an-import-job",
      paginationOpts: { cursor: null, numItems: 100 },
    }),
  ).resolves.toBeNull();
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<script>start({reviews:[]})</script>")),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    },
  );
  await t.finishAllScheduledFunctions(() => vi.runAllTimers(), 100);
  await expect(
    owner.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    }),
  ).resolves.toBeNull();
});

it("expires preview content while preserving a completed import result", async () => {
  vi.useFakeTimers();
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "session",
      where: [{ field: "_id", value: owner.sessionId }],
      update: { expiresAt: Date.now() + 48 * 60 * 60 * 1000 },
    },
  });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          '<script>start({reviews:[{id:"one",type:"text",text:"My original words.",customer:{name:"Lina Moreau"}}]})</script>',
          { headers: { "content-type": "text/html" } },
        ),
    ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: preview!.items.page.map((item) => item._id),
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers(), 100);
  const expired = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  expect(expired!.items.page).toEqual([]);
  expect(expired!.result).toEqual({
    imported: 1,
    skipped: 0,
    changed: 0,
    unavailable: 0,
  });
});

it("limits repeated wall retrieval before making another provider request", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const fetchWall = vi.fn(
    async () =>
      new Response("<script>start({reviews:[]})</script>", {
        headers: { "content-type": "text/html" },
      }),
  );
  vi.stubGlobal("fetch", fetchWall);
  for (let index = 0; index < 10; index++)
    await owner.client.action(api.testimonialImportSource.preview, {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    });
  await expect(
    owner.client.action(api.testimonialImportSource.preview, {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    }),
  ).rejects.toMatchObject({ data: { code: "IMPORT_RATE_LIMITED" } });
  expect(fetchWall).toHaveBeenCalledTimes(10);
});

it("imports text without consuming credits and admits only 13 concurrent Free publications", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const reviews = Array.from({ length: 14 }, (_, index) => ({
    id: `customer-${index}`,
    type: "text",
    text: `Customer story ${index + 1}.`,
    customer: { name: `Customer ${index + 1}` },
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          `<script>start({reviews:${JSON.stringify(reviews)}})</script>`,
          { headers: { "content-type": "text/html" } },
        ),
    ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: preview!.items.page.map((item) => item._id),
  });
  const account = await owner.client.query(api.accounts.getMine, {});
  expect(account?.usage.freeTextUsed).toBe(0);
  const inbox = await owner.client.query(api.testimonialModeration.listInbox, {
    organizationId: project.id,
    sort: "newest",
    paginationOpts: { cursor: null, numItems: 20 },
  });
  const results = await Promise.allSettled(
    inbox.page.map((item) =>
      owner.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: project.id,
        testimonialId: item.testimonialId,
        status: "published",
        importAttestationAccepted: true,
        importAttestationVersion: "2026-09-09",
      }),
    ),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(13);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  expect(results.find((result) => result.status === "rejected")).toMatchObject({
    reason: { data: { code: "FREE_PUBLICATION_LIMIT_REACHED" } },
  });
  // A plan change invalidates older publications except the explicitly kept set.
  // The hidden projection must not consume a place when importing new proof.
  const remaining =
    inbox.page[results.findIndex((result) => result.status === "rejected")]!;
  await t.run(async (ctx) => {
    const accountId = (await ctx.db.get(project.id))!.accountId!;
    const published = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_organization", (q) => q.eq("organizationId", project.id))
      .take(20);
    await ctx.db.patch(accountId, {
      publicationGeneration: 1,
      preservedPublicationIds: published
        .slice(0, 12)
        .map((item) => item.testimonialId),
    });
  });
  await expect(
    owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: project.id,
      testimonialId: remaining.testimonialId,
      status: "published",
      importAttestationAccepted: true,
      importAttestationVersion: "2026-09-09",
    }),
  ).resolves.toMatchObject({ moderationStatus: "published" });
  const repeat = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    },
  );
  const repeatPreview = await owner.client.query(
    api.testimonialImports.getPreview,
    { jobId: repeat.jobId, paginationOpts: { cursor: null, numItems: 100 } },
  );
  expect(
    repeatPreview!.items.page.every(
      (item) => item.sourceState === "already_imported",
    ),
  ).toBe(true);
  reviews[0]!.text = "An updated customer story.";
  const changed = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://senja.io/p/willow/wall-of-love",
    },
  );
  const changedPreview = await owner.client.query(
    api.testimonialImports.getPreview,
    { jobId: changed.jobId, paginationOpts: { cursor: null, numItems: 100 } },
  );
  expect(
    changedPreview!.items.page.find((item) => item.sourceId === "customer-0")
      ?.sourceState,
  ).toBe("changed");
  await owner.client.mutation(api.testimonialModeration.setStatus, {
    organizationId: project.id,
    testimonialId: remaining.testimonialId,
    status: "archived",
  });
  await t.run(async (ctx) => {
    const original = (await ctx.db.get(project.id))!;
    const { _id, _creationTime, ...fields } = original;
    void _id;
    void _creationTime;
    const selectedProjectId = await ctx.db.insert("organizations", {
      ...fields,
      name: "Willow Workshops",
      slug: "willow-workshops",
      publicSlug: "willow-workshops",
    });
    await ctx.db.patch(original.accountId!, {
      selectedFreeProjectId: selectedProjectId,
    });
  });
  await expect(
    owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: project.id,
      testimonialId: remaining.testimonialId,
      status: "published",
    }),
  ).rejects.toMatchObject({ data: { code: "PROJECT_INACTIVE" } });
});

it("persists a source preview for its Project owner and denies another owner", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const other = await authenticatedUser(t, { email: "other@example.com" });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Import Studio",
    privacyContact: "privacy@example.com",
    publicSlug: "import-studio",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            '<article class="testimonial-card text-testimonial"><span class="font-bold">Camille</span><div class="show-more-text">Exactly my words.</div></article>',
          ),
          { headers: { "content-type": "text/html" } },
        ),
    ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://testimonial.to/example/all",
    },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  expect(preview!.sourceUrl).toBe("https://testimonial.to/example/all");
  expect(preview!.items.page).toEqual([
    expect.objectContaining({
      authorName: "Camille",
      text: "Exactly my words.",
      type: "text",
    }),
  ]);
  expect(preview!.items.isDone).toBe(true);
  const selectedIds = preview!.items.page.map((item) => item._id);
  await owner.client.mutation(api.testimonialImports.setSelection, {
    jobId,
    itemIds: selectedIds,
  });
  expect(
    (await owner.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    }))!.selectedItemIds,
  ).toEqual(selectedIds);
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId,
      itemIds: selectedIds,
    }),
  ).toEqual({ imported: 1, skipped: 0, changed: 0, unavailable: 0 });
  expect(
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId,
      itemIds: selectedIds,
    }),
  ).toEqual({ imported: 1, skipped: 0, changed: 0, unavailable: 0 });
  expect(
    (await owner.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    }))!.result,
  ).toEqual({ imported: 1, skipped: 0, changed: 0, unavailable: 0 });
  const inbox = await owner.client.query(api.testimonialModeration.listInbox, {
    organizationId: project.id,
    paginationOpts: { cursor: null, numItems: 20 },
    sort: "newest",
  });
  expect(inbox.page).toHaveLength(1);
  expect(inbox.page[0]).toMatchObject({
    moderationStatus: "pending",
    submitterName: "Camille",
  });
  expect(inbox.page[0]?.submitterEmail).toBeUndefined();
  expect(inbox.page[0]?.consentAcceptedAt).toBeUndefined();
  const testimonialId = inbox.page[0]!.testimonialId;
  const privateArgs = { organizationId: project.id, testimonialId };
  const privateProof = await owner.client.query(
    api.submissions.getPrivate,
    privateArgs,
  );
  expect(privateProof.importOrigin).toMatchObject({
    originalAuthorName: "Camille",
    originalText: "Exactly my words.",
  });
  expect(privateProof.consentAcceptedAt).toBeUndefined();
  expect(privateProof.consentText).toBeUndefined();
  expect(privateProof.submitterEmail).toBeUndefined();
  await expect(
    other.client.query(api.submissions.getPrivate, privateArgs),
  ).rejects.toThrow();
  await expect(
    owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: project.id,
      testimonialId,
      status: "published",
    }),
  ).rejects.toMatchObject({ data: { code: "IMPORT_ATTESTATION_REQUIRED" } });
  await owner.client.mutation(api.testimonialModeration.setStatus, {
    organizationId: project.id,
    testimonialId,
    status: "published",
    importAttestationAccepted: true,
    importAttestationVersion: "2026-09-09",
  });
  const publishedInbox = await owner.client.query(
    api.testimonialModeration.listInbox,
    {
      organizationId: project.id,
      sort: "newest",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(publishedInbox.page[0]?.moderationStatus).toBe("published");
  expect(publishedInbox.page[0]?.consentAcceptedAt).toBeUndefined();
  expect(
    (await owner.client.query(api.submissions.getPrivate, privateArgs))
      .importOrigin?.publicationAttestation,
  ).toMatchObject({ version: "2026-09-09" });
  const wall = await t.query(api.publicWall.list, {
    publicSlug: "import-studio",
    secret: "wall-import-test-secret-32-characters-long",
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(wall.page).toHaveLength(1);
  expect(wall.page[0]).toMatchObject({
    name: "Camille",
    text: "Exactly my words.",
  });
  expect(JSON.stringify(wall.page)).not.toContain("importOrigin");
  expect(JSON.stringify(wall.page)).not.toContain("acceptedBy");
  await owner.client.mutation(api.testimonialModeration.remove, {
    organizationId: project.id,
    testimonialId,
  });
  const afterDeletion = await owner.client.query(
    api.testimonialImports.getPreview,
    {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    },
  );
  expect(afterDeletion!.items.page).toEqual([]);
  await expect(
    other.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    }),
  ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  vi.mocked(fetch).mockClear();
  await expect(
    other.client.action(api.testimonialImportSource.preview, {
      organizationId: project.id,
      url: "https://testimonial.to/example/all",
    }),
  ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  expect(fetch).not.toHaveBeenCalled();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
  expect(
    (await owner.client.query(api.testimonialImports.getPreview, {
      jobId,
      paginationOpts: { cursor: null, numItems: 100 },
    }))!.result,
  ).toEqual({ imported: 1, skipped: 0, changed: 0, unavailable: 0 });
  await expect(
    owner.client.mutation(api.testimonialImports.confirm, {
      jobId,
      itemIds: selectedIds,
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_EXPIRED" } });
});

it("keeps import-specific Inbox counts and pagination after preview deletion, without crossing Projects", async () => {
  vi.useFakeTimers();
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const other = await authenticatedUser(t, {
    email: "camille-other@example.com",
  });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  const otherProject = await other.client.mutation(api.organizations.create, {
    name: "Birch Studio",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            Array.from(
              { length: 3 },
              (_, i) =>
                `<article class="testimonial-card text-testimonial"><span class="font-bold">Camille ${i}</span><div class="show-more-text">Original words ${i}.</div></article>`,
            ).join(""),
          ),
        ),
    ),
  );
  async function importWall(slug: string) {
    const { jobId } = await owner.client.action(
      api.testimonialImportSource.preview,
      { organizationId: project.id, url: `https://testimonial.to/${slug}/all` },
    );
    const preview = await owner.client.query(
      api.testimonialImports.getPreview,
      { jobId, paginationOpts: { cursor: null, numItems: 100 } },
    );
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId,
      itemIds: preview!.items.page.map((item) => item._id),
    });
    return jobId;
  }
  const firstJob = await importWall("atelier-june");
  const secondJob = await importWall("birch-studio");
  const filter = { organizationId: project.id, importJobId: firstJob };
  expect(
    await owner.client.query(api.testimonialModeration.countInbox, filter),
  ).toEqual({ pending: 3, published: 0, archived: 0, spam: 0 });
  const args = {
    ...filter,
    status: "pending" as const,
    sort: "newest" as const,
    paginationOpts: { cursor: null as string | null, numItems: 1 },
  };
  const ids = [];
  let page;
  do {
    page = await owner.client.query(api.testimonialModeration.listInbox, args);
    ids.push(...page.page.map((row) => row.testimonialId));
    args.paginationOpts.cursor = page.continueCursor;
  } while (!page.isDone);
  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  for (const testimonialId of ids.slice(0, 2)) {
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: project.id,
      testimonialId,
      status: "published",
      importAttestationAccepted: true,
      importAttestationVersion: "2026-09-09",
    });
  }
  const published = await owner.client.query(
    api.testimonialModeration.listInbox,
    {
      ...args,
      status: "published",
      sort: "wall",
      paginationOpts: { cursor: null, numItems: 20 },
    },
  );
  expect(published.page.map((row) => row.testimonialId)).toEqual([
    ids[1],
    ids[0],
  ]);
  expect(
    await owner.client.query(api.testimonialModeration.countInbox, filter),
  ).toEqual({ pending: 1, published: 2, archived: 0, spam: 0 });
  expect(
    (
      await owner.client.query(api.testimonialModeration.countInbox, {
        organizationId: project.id,
        importJobId: secondJob,
      })
    ).pending,
  ).toBe(3);
  await t.run(async (ctx) => {
    await ctx.db.delete(firstJob);
  });
  expect(
    (await owner.client.query(api.testimonialModeration.countInbox, filter))
      .published,
  ).toBe(2);
  expect(
    (
      await owner.client.query(api.testimonialModeration.listInbox, {
        ...args,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page,
  ).toHaveLength(1);
  expect(
    await other.client.query(api.testimonialModeration.countInbox, {
      organizationId: otherProject.id,
      importJobId: firstJob,
    }),
  ).toEqual({ pending: 0, published: 0, archived: 0, spam: 0 });
  await expect(
    other.client.query(api.testimonialModeration.countInbox, filter),
  ).rejects.toThrow();
  await expect(
    other.client.query(api.testimonialModeration.listInbox, {
      ...args,
      paginationOpts: { cursor: null, numItems: 20 },
    }),
  ).rejects.toThrow();
  for (const importJobId of ["", "invalid"]) {
    expect(
      (
        await owner.client.query(api.testimonialModeration.listInbox, {
          ...args,
          importJobId,
          paginationOpts: { cursor: null, numItems: 20 },
        })
      ).page,
    ).toEqual([]);
    expect(
      (
        await owner.client.query(api.testimonialModeration.countInbox, {
          ...filter,
          importJobId,
        })
      ).pending,
    ).toBe(0);
  }
});
