import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";
import { withTestimonialIds } from "./testimonial-source-fixture";

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

async function imported(confirm = true) {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(
            withTestimonialIds(
              '<article class="testimonial-card text-testimonial"><img src="https://cdn.testimonial.to/avatar.png"><span class="font-bold">Camille Laurent</span><div class="show-more-text">A lovely pottery class.</div></article>',
            ),
          ),
      ),
  );
  const { jobId } = await owner.client.action(
    api.testimonialImportSource.preview,
    {
      organizationId: project.id,
      url: "https://testimonial.to/atelier-june/all",
    },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const itemId = preview!.items.page[0]!._id;
  if (confirm)
    await owner.client.mutation(api.testimonialImports.confirm, {
      jobId,
      itemIds: [itemId],
    });
  const item = (await t.run((ctx) => ctx.db.get(itemId)))!;
  return { t, owner, itemId, jobId, testimonialId: item.testimonialId! };
}

it("copies a source avatar into independent storage after text confirmation", async () => {
  const { t, itemId, testimonialId } = await imported();
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      async () =>
        new Response(bytes, {
          headers: { "content-type": "image/png" },
        }),
    ),
  );
  await t.action(internal.testimonialImportAvatar.copy, {
    attempt: (await t.run((ctx) => ctx.db.get(itemId)))!.avatarAttempt!,
    itemId,
    testimonialId,
  });
  const testimonial = (await t.run((ctx) => ctx.db.get(testimonialId)))!;
  expect(testimonial.avatarStorageId).toBeDefined();
  expect(testimonial.importOrigin?.originalAvatarUrl).toBe(
    "https://cdn.testimonial.to/avatar.png",
  );
  const file = await t.run(async (ctx) =>
    (await ctx.storage.get(testimonial.avatarStorageId!))!.arrayBuffer(),
  );
  expect(new Uint8Array(file)).toEqual(bytes);
  expect((await t.run((ctx) => ctx.db.get(itemId)))?.avatarStatus).toBe(
    "ready",
  );
  // A repeated delivery keeps the existing image, rather than downloading twice.
  await t.action(internal.testimonialImportAvatar.copy, {
    attempt: (await t.run((ctx) => ctx.db.get(itemId)))!.avatarAttempt!,
    itemId,
    testimonialId,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("records a failed avatar without discarding the imported quotation", async () => {
  const { t, itemId, testimonialId } = await imported();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("upstream unavailable")),
  );
  await t.action(internal.testimonialImportAvatar.copy, {
    attempt: (await t.run((ctx) => ctx.db.get(itemId)))!.avatarAttempt!,
    itemId,
    testimonialId,
  });
  expect((await t.run((ctx) => ctx.db.get(itemId)))?.avatarStatus).toBe(
    "failed",
  );
  expect(await t.run((ctx) => ctx.db.get(testimonialId))).toMatchObject({
    text: "A lovely pottery class.",
  });
});

it("retries only an owned failed photo and reports its recovery", async () => {
  const { t, owner, itemId, jobId, testimonialId } = await imported();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("source unavailable")),
  );
  await t.action(internal.testimonialImportAvatar.copy, {
    attempt: (await t.run((ctx) => ctx.db.get(itemId)))!.avatarAttempt!,
    itemId,
    testimonialId,
  });
  expect(
    await owner.client.query(api.testimonialImportAvatar.progress, { jobId }),
  ).toMatchObject([{ itemId, status: "failed" }]);
  const other = await authenticatedUser(t, { email: "not-owner@example.test" });
  await expect(
    other.client.mutation(api.testimonialImportAvatar.retry, { itemId }),
  ).rejects.toThrow();
  await owner.client.mutation(api.testimonialImportAvatar.retry, { itemId });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
          headers: { "content-type": "image/png" },
        }),
    ),
  );
  await t.action(internal.testimonialImportAvatar.copy, {
    attempt: (await t.run((ctx) => ctx.db.get(itemId)))!.avatarAttempt!,
    itemId,
    testimonialId,
  });
  expect(
    await owner.client.query(api.testimonialImportAvatar.progress, { jobId }),
  ).toMatchObject([{ itemId, status: "ready" }]);
  await expect(
    owner.client.mutation(api.testimonialImportAvatar.retry, { itemId }),
  ).rejects.toThrow();
});

it("the periodic sweep removes a crash-left file without another upload", async () => {
  const t = createConvexTest();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["interrupted"], { type: "image/png" })),
  );
  vi.setSystemTime(Date.now() + 3 * 60 * 60 * 1000);
  await t.mutation(internal.storageCleanup.requestOrphanedStorageCleanup, {});
  const job = (await t.run((ctx) =>
    ctx.db.query("storageCleanupJobs").first(),
  ))!;
  await t.mutation(internal.storageCleanup.cleanupUnreferencedAvatarStorage, {
    cleanupJobId: job._id,
    attemptId: job.attemptId,
  });
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
});

it("discards a late copy after deletion without resurrecting the testimonial", async () => {
  const { t, itemId, testimonialId } = await imported();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["photo"], { type: "image/png" })),
  );
  await t.run((ctx) => ctx.db.delete(testimonialId));
  await t.mutation(internal.testimonialImportAvatar.finish, {
    attempt: 1,
    itemId,
    testimonialId,
    sourceUrl: "https://cdn.testimonial.to/avatar.png",
    storageId,
  });
  expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(testimonialId))).toBeNull();
});

it("keeps a newer photo and deletes the stale downloaded copy", async () => {
  const { t, itemId, testimonialId } = await imported();
  const [newer, stale] = await t.run(async (ctx) =>
    Promise.all([
      ctx.storage.store(new Blob(["new"], { type: "image/png" })),
      ctx.storage.store(new Blob(["old"], { type: "image/png" })),
    ]),
  );
  await t.run((ctx) => ctx.db.patch(testimonialId, { avatarStorageId: newer }));
  await t.mutation(internal.testimonialImportAvatar.finish, {
    attempt: 1,
    itemId,
    testimonialId,
    sourceUrl: "https://cdn.testimonial.to/avatar.png",
    storageId: stale,
  });
  expect(
    (await t.run((ctx) => ctx.db.get(testimonialId)))?.avatarStorageId,
  ).toBe(newer);
  expect(await t.run((ctx) => ctx.storage.get(stale))).toBeNull();
  expect(
    await t.run(async (ctx) => Boolean(await ctx.storage.get(newer))),
  ).toBe(true);
});

it("keeps a manually uploaded avatar through identity edits and confirmation", async () => {
  const { t, owner, itemId, jobId } = await imported(false);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
  await owner.client.action(api.importAvatarUpload.upload, {
    target: { itemId },
    bytes,
  });
  const saved = (await t.run((ctx) => ctx.db.get(itemId)))!.identityCorrection!
    .avatarStorageId!;
  await owner.client.mutation(api.testimonialImports.correctIdentity, {
    itemId,
    authorName: "Camille Roche",
    tagline: "Ceramic artist",
  });
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  expect(preview!.items.page[0]!.avatarUrl).toBe(
    await t.run((ctx) => ctx.storage.getUrl(saved)),
  );
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: [itemId],
  });
  const item = (await t.run((ctx) => ctx.db.get(itemId)))!;
  expect(
    (await t.run((ctx) => ctx.db.get(item.testimonialId!)))?.avatarStorageId,
  ).toBe(saved);
  expect(item.avatarStatus).toBeUndefined();
});

it("refuses another Owner's photo upload before storing a file", async () => {
  const { t, itemId } = await imported(false);
  const other = await authenticatedUser(t, { email: "outsider@example.test" });
  await expect(
    other.client.action(api.importAvatarUpload.upload, {
      target: { itemId },
      bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
    }),
  ).rejects.toThrow();
  expect(
    await t.run((ctx) => ctx.db.query("importAvatarUploads").collect()),
  ).toEqual([]);
});

it("removing the source photo prevents it being copied again on confirmation", async () => {
  const { t, owner, itemId, jobId } = await imported(false);
  await owner.client.mutation(api.importAvatarUpload.remove, {
    target: { itemId },
  });
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: [itemId],
  });
  const item = (await t.run((ctx) => ctx.db.get(itemId)))!;
  expect(item.avatarStatus).toBeUndefined();
  expect(
    (await t.run((ctx) => ctx.db.get(item.testimonialId!)))?.avatarStorageId,
  ).toBeUndefined();
});

it("expires an interrupted attempt and fences its late result from a retry", async () => {
  const { t, owner, itemId, testimonialId } = await imported();
  const stale = await t.run((ctx) => ctx.storage.store(new Blob(["old"])));
  await t.mutation(internal.testimonialImportAvatar.expireAttempt, {
    itemId,
    testimonialId,
    attempt: 1,
  });
  expect((await t.run((ctx) => ctx.db.get(itemId)))?.avatarStatus).toBe(
    "failed",
  );
  await owner.client.mutation(api.testimonialImportAvatar.retry, { itemId });
  await t.mutation(internal.testimonialImportAvatar.finish, {
    itemId,
    testimonialId,
    attempt: 1,
    sourceUrl: "https://cdn.testimonial.to/avatar.png",
    storageId: stale,
  });
  await t.mutation(internal.testimonialImportAvatar.expireAttempt, {
    itemId,
    testimonialId,
    attempt: 1,
  });
  expect(await t.run((ctx) => ctx.storage.get(stale))).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(itemId))).toMatchObject({
    avatarStatus: "processing",
    avatarAttempt: 2,
  });
  expect(
    (await t.run((ctx) => ctx.db.get(testimonialId)))?.avatarStorageId,
  ).toBeUndefined();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
          headers: { "content-type": "image/png" },
        }),
    ),
  );
  await t.action(internal.testimonialImportAvatar.copy, {
    itemId,
    testimonialId,
    attempt: 2,
  });
  await t.mutation(internal.testimonialImportAvatar.expireAttempt, {
    itemId,
    testimonialId,
    attempt: 2,
  });
  expect((await t.run((ctx) => ctx.db.get(itemId)))?.avatarStatus).toBe(
    "ready",
  );
});
