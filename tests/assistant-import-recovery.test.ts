import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, components, internal } from "../convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
  testImageMetadata,
} from "./convex-test-helpers";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("MUX_PROVIDER", "fake");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_recovery");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_recovery");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  await addStripeSubscription(t, project.id, "active");
  await owner.client.mutation(api.assistantImports.activate, {
    organizationId: project.id,
    acceptReuseRights: true,
  });
  const clientId = "recovery-assistant";
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthClient",
      data: {
        clientId,
        redirectUris: ["https://client.example/callback"],
        scopes: ["testimonials:import"],
      },
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId,
        userId: owner.actorId,
        scopes: ["testimonials:import"],
      },
    },
  });
  const grant = {
    actorId: owner.actorId,
    clientId,
    issuedAt: Date.now(),
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 900_000,
  };
  const input = {
    grant,
    organizationId: project.id,
    sourceUrl: "https://willow.example/stories",
    requestId: "mixed-recovery",
    discoveredCount: 27,
    items: [
      {
        sourceId: "text",
        type: "text" as const,
        authorName: "Camille Roche",
        text: "A lovely pottery class.",
        portraitUrl: "https://media.example/camille.jpg",
      },
      ...Array.from({ length: 26 }, (_, index) => ({
        sourceId: `video-${index}`,
        type: "video" as const,
        authorName: `Customer ${index + 1}`,
        text: "",
        videoUrl: `https://media.example/${index}.mp4`,
      })),
    ],
  };
  const batch = await t.mutation(internal.assistantImports.submitBatch, input);
  return { t, owner, project, grant, input, batch };
}
it("resumes only the chosen failed videos, rejects an oversized selection atomically and retains successful text", async () => {
  const { t, owner, project, input, batch } = await fixture();
  const selected = batch.outcomes
    .filter((item) => item.status === "blocked")
    .map((item) => item.itemId);
  expect(batch.result).toMatchObject({ imported: 1, blocked: 26 });
  await owner.client.mutation(api.assistantImports.resumeVideos, {
    jobId: batch.jobId,
    itemIds: selected.slice(0, 2),
  });
  let progress = await owner.client.query(api.assistantImports.inboxStatus, {
    organizationId: project.id,
    jobId: batch.jobId,
  });
  expect(progress).toMatchObject({
    availableVideoSlots: 23,
    createdCount: 27,
    result: { imported: 1, processing: 2, blocked: 24 },
  });
  await expect(
    owner.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: selected.slice(2),
    }),
  ).rejects.toThrow(/23/);
  progress = await owner.client.query(api.assistantImports.inboxStatus, {
    organizationId: project.id,
    jobId: batch.jobId,
  });
  expect(progress?.result).toMatchObject({ processing: 2, blocked: 24 });
  await expect(
    owner.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: [selected[0]],
    }),
  ).rejects.toThrow(/failed/i);
  const replay = await t.mutation(internal.assistantImports.submitBatch, input);
  expect(replay.jobId).toBe(batch.jobId);
  expect(replay.result).toMatchObject({ processing: 2, blocked: 24 });
  const inbox = await owner.client.query(api.testimonialModeration.listInbox, {
    organizationId: project.id,
    status: "pending",
    sort: "newest",
    paginationOpts: { cursor: null, numItems: 50 },
  });
  expect(inbox.page).toHaveLength(27);
});
it("rejects other Owners, another job's items and new media retries after Pro ends", async () => {
  const { t, owner, project, batch, input } = await fixture();
  const selected = batch.outcomes
    .filter((item) => item.status === "blocked")
    .map((item) => item.itemId);
  const other = await authenticatedUser(t, { email: "other@example.com" });
  await expect(
    other.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: selected.slice(0, 1),
    }),
  ).rejects.toThrow();
  await expect(
    owner.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: [selected[0], selected[0]],
    }),
  ).rejects.toThrow();
  const otherJob = await t.mutation(internal.assistantImports.submitBatch, {
    ...input,
    requestId: "another-job",
    discoveredCount: 1,
    items: [
      {
        sourceId: "another-local-video",
        type: "video",
        authorName: "Lina Moreau",
        text: "",
      },
    ],
  });
  await expect(
    owner.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: [otherJob.outcomes[0].itemId],
    }),
  ).rejects.toThrow();
  const textItem = batch.outcomes.find((item) => item.sourceId === "text")!;
  await t.run(async (ctx) => {
    await ctx.db.patch(textItem.itemId, { avatarStatus: "failed" });
  });
  await addStripeSubscription(t, project.id, "canceled", {
    eventCreated: Math.floor(Date.now() / 1000) + 1,
  });
  await expect(
    owner.client.mutation(api.assistantImports.resumeVideos, {
      jobId: batch.jobId,
      itemIds: selected.slice(0, 1),
    }),
  ).rejects.toThrow(/Pro/);
  await expect(
    owner.client.mutation(api.testimonialImportAvatar.retry, {
      itemId: textItem.itemId,
    }),
  ).rejects.toThrow(/Pro/);
});

it("recovers a failed portrait once, preserves its copied asset and keeps recent imports scoped to their Owner", async () => {
  const { t, owner, project, batch } = await fixture();
  const itemId = batch.outcomes.find(
    (item) => item.sourceId === "text",
  )!.itemId;
  await t.run(async (ctx) => {
    await ctx.db.patch(itemId, { avatarStatus: "failed" });
  });
  await owner.client.mutation(api.testimonialImportAvatar.retry, { itemId });
  const item = await t.run((ctx) => ctx.db.get(itemId));
  expect(item?.avatarStatus).toBe("processing");
  const stored = new Blob(["webp-fixture"], { type: "image/webp" });
  const storageId = await t.run((ctx) => ctx.storage.store(stored));
  await t.mutation(internal.testimonialImportAvatar.finish, {
    itemId,
    testimonialId: item!.testimonialId!,
    attempt: item!.avatarAttempt!,
    sourceUrl: item!.avatarUrl!,
    storageId,
    metadata: testImageMetadata("submitterPhoto", stored.size, {
      source: "import",
    }),
  });
  await expect(
    owner.client.mutation(api.testimonialImportAvatar.retry, { itemId }),
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.get(item!.testimonialId!))).toMatchObject({
    avatarStorageId: storageId,
    moderationStatus: "pending",
    submitterName: "Camille Roche",
  });
  const jobs = await owner.client.query(api.assistantImports.recent, {
    organizationId: project.id,
  });
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toEqual({
    jobId: batch.jobId,
    sourceUrl: "https://willow.example/stories",
    createdAt: expect.any(Number),
    result: expect.any(Object),
  });
  const other = await authenticatedUser(t, {
    email: "history-other@example.com",
  });
  await expect(
    other.client.query(api.assistantImports.recent, {
      organizationId: project.id,
    }),
  ).rejects.toThrow();
});
