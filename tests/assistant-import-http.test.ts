import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, components, internal } from "../convex/_generated/api";
import { createImportOAuth } from "../convex/importOAuth";
import { POST } from "../src/app/mcp/route";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "./convex-test-helpers";

beforeEach(() => {
  for (const [key, value] of Object.entries({
    EMAIL_PROVIDER: "test",
    MUX_PROVIDER: "fake",
    SITE_URL: "http://localhost:3000",
    CHATGPT_IMPORT_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_assistant_http",
    STRIPE_WEBHOOK_SECRET: "whsec_test_assistant_http",
    BETTER_AUTH_SECRET: "assistant-http-fixture-secret-not-a-real-credential",
    CONVEX_SITE_URL: "https://fixture.convex.site",
    NEXT_PUBLIC_CONVEX_URL: "https://fixture.convex.cloud",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://fixture.convex.site",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("verifies a signed OAuth bearer across MCP and Convex HTTP for import, destinations and status", async () => {
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
  const clientId = "ordinary-http-client";
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
  const sign = (actorId: string) =>
    t.run(async (ctx) => {
      const auth = await createImportOAuth(ctx);
      const now = Math.floor(Date.now() / 1000);
      return auth.api.signJWT({
        body: {
          payload: {
            sub: actorId,
            azp: clientId,
            scope: "testimonials:import",
            iat: now,
            exp: now + 900,
          },
        },
      });
    });
  const { token } = await sign(owner.actorId);
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const target = new URL(url);
    if (target.origin !== "https://fixture.convex.site")
      throw new Error("Unexpected test destination");
    return t.fetch(target.pathname + target.search, init);
  });
  async function call(
    name: string,
    args: Record<string, unknown>,
    bearer = token,
  ) {
    const response = await POST(
      new Request("http://localhost:3000/mcp", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args },
        }),
      }),
    );
    expect(response.status).toBe(200);
    return (await response.json()).result;
  }
  expect(
    (await call("list_assistant_import_projects", {})).structuredContent.page,
  ).toMatchObject([{ id: project.id }]);
  const imported = await call("import_testimonial_text", {
    sourceUrl: "https://willow.example/customers",
    sourceId: "camille-1",
    authorName: "Camille Roche",
    text: "I made my first bowl!",
  });
  expect(imported.isError).not.toBe(true);
  expect(imported.structuredContent.inboxUrl).toContain(
    `/org/${project.slug}/inbox?import=`,
  );
  const status = await call("read_assistant_import", {
    jobId: imported.structuredContent.jobId,
  });
  expect(status.structuredContent.result.imported).toBe(1);
  expect(
    (await call("list_assistant_import_projects", {}, `${token}tampered`))
      .isError,
  ).toBe(true);
  const second = await owner.client.mutation(api.organizations.create, {
    name: "Willow Workshops",
  });
  const input = {
    sourceUrl: "https://willow.example/customers",
    sourceId: "lea-2",
    authorName: "Léa Garnier",
    text: "A great workshop.",
  };
  expect((await call("import_testimonial_text", input)).isError).toBe(true);
  expect(
    (
      await call("import_testimonial_text", {
        ...input,
        organizationId: second.id,
      })
    ).structuredContent.result.imported,
  ).toBe(1);
  const batchInput = {
    organizationId: project.id,
    migrationId: "willow-page-migration",
    requestId: "willow-page-batch-1",
    sourceUrl: "https://willow.example/customers",
    discoveredCount: 2,
    items: [
      {
        sourceId: "batch-camille",
        authorName: "Camille Roche",
        text: "The studio felt welcoming.",
      },
      {
        sourceId: "batch-lea",
        authorName: "Léa Garnier",
        text: "We will book another class.",
      },
    ],
  };
  const [first, replay] = await Promise.all([
    call("import_testimonials", batchInput),
    call("import_testimonials", batchInput),
  ]);
  expect(first.structuredContent.result.imported).toBe(2);
  expect(replay.structuredContent.jobId).toBe(first.structuredContent.jobId);
  const resumed = await call("read_assistant_import", {
    jobId: first.structuredContent.jobId,
  });
  expect(resumed.structuredContent.outcomes).toEqual(
    first.structuredContent.outcomes,
  );
  expect(
    resumed.structuredContent.outcomes.map(
      (item: { status: string }) => item.status,
    ),
  ).toEqual(["created", "created"]);

  const duplicates = await call("import_testimonials", {
    ...batchInput,
    requestId: "willow-page-batch-2",
  });
  expect(duplicates.structuredContent.result).toMatchObject({
    imported: 0,
    skipped: 2,
  });
  const conflict = await call("import_testimonials", {
    ...batchInput,
    requestId: "willow-page-batch-3",
    items: [{ ...batchInput.items[0], text: "Different source words." }],
  });
  expect(conflict.structuredContent.result).toMatchObject({
    imported: 0,
    changed: 1,
  });
  expect(
    (
      await call("import_testimonials", {
        ...batchInput,
        items: Array.from({ length: 51 }, (_, i) => ({
          ...batchInput.items[0],
          sourceId: String(i),
        })),
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await call("import_testimonials", {
        ...batchInput,
        items: [{ ...batchInput.items[0], text: "Changed replay." }],
      })
    ).isError,
  ).toBe(true);

  const migration = await call("read_assistant_import_migration", {
    organizationId: project.id,
    migrationId: batchInput.migrationId,
  });
  expect(migration.structuredContent).toMatchObject({
    discoveredCount: 2,
    processedCount: 2,
    remainingCount: 0,
    batchCount: 3,
    result: { imported: 2, skipped: 2, changed: 1 },
  });
  expect(migration.structuredContent.page).toHaveLength(3);
  expect(
    migration.structuredContent.page.map(
      (batch: { jobId: string }) => batch.jobId,
    ),
  ).toContain(first.structuredContent.jobId);

  const unnamed = await call("import_testimonial_text", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    sourceId: "explicit-card-without-name",
    text: "A wonderful class.",
  });
  expect(unnamed.structuredContent.result.imported).toBe(1);
  const preserved = await t.run((ctx) =>
    ctx.db
      .query("testimonials")
      .filter((q) =>
        q.eq(q.field("importJobId"), unnamed.structuredContent.jobId),
      )
      .unique(),
  );
  expect(preserved?.submitterName).toBe("");

  for (const [label, duration, verified, expected] of [
    ["ten-minutes", 600, true, "ready"],
    ["over-limit", 601, true, "failed"],
    ["unverified-file", 30, false, "failed"],
  ] as const) {
    const video = await call("import_testimonials", {
      organizationId: project.id,
      sourceUrl: input.sourceUrl,
      requestId: label,
      discoveredCount: 1,
      items: [
        {
          sourceId: label,
          type: "video",
          authorName: "Camille Roche",
          videoUrl: "https://media.example/original.mp4",
        },
      ],
    });
    expect(video.structuredContent.result.processing).toBe(1);
    const saved = await t.run(async (ctx) => {
      const item = await ctx.db
        .query("testimonialImportItems")
        .withIndex("by_jobId_and_position", (q) =>
          q.eq("jobId", video.structuredContent.jobId),
        )
        .first();
      const asset = await ctx.db.get(item!.videoAssetId!);
      const testimonial = await ctx.db.get(item!.testimonialId!);
      expect(testimonial?.text).toBe("");
      expect(testimonial?.moderationStatus).toBe("pending");
      return asset!;
    });
    if (verified) {
      await t.mutation(internal.testimonialImportVideo.attachAssistantUpload, {
        assetId: saved._id,
        providerUploadId: `upload-${label}`,
      });
      await t.mutation(internal.testimonialImportVideo.verifyAssistantFile, {
        assetId: saved._id,
        fileSizeBytes: 1024,
        mimeType: "video/mp4",
      });
    }
    await t.mutation(internal.videoWebhooks.applyEvent, {
      event: {
        id: `event-${label}`,
        type: "video.asset.ready",
        data: {
          id: `asset-${label}`,
          passthrough: saved.reservationId,
          duration,
          playback_ids: [{ id: `playback-${label}`, policy: "public" }],
        },
      },
      retryTokenHash: "fixture-hash",
      retryTokenSeed: "fixture-seed",
    });
    const progress = await call("read_assistant_import", {
      jobId: video.structuredContent.jobId,
    });
    expect(progress.structuredContent.videos[0].status).toBe(expected);
  }

  const retriedVideo = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "cancelled-attempt",
    discoveredCount: 1,
    items: [
      {
        sourceId: "cancelled-attempt",
        type: "video",
        videoUrl: "https://media.example/retry.mp4",
      },
    ],
  });
  const retryAsset = await t.run(async (ctx) => {
    const item = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (q) =>
        q.eq("jobId", retriedVideo.structuredContent.jobId),
      )
      .first();
    return (await ctx.db.get(item!.videoAssetId!))!;
  });
  await t.mutation(internal.testimonialImportVideo.attachAssistantUpload, {
    assetId: retryAsset._id,
    providerUploadId: "retired-upload",
  });
  await t.mutation(internal.testimonialImportVideo.resetAssistantUpload, {
    assetId: retryAsset._id,
  });
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: {
      id: "cancelled-retired-event",
      type: "video.upload.cancelled",
      data: { id: "retired-upload" },
    },
    retryTokenHash: "fixture-hash",
    retryTokenSeed: "fixture-seed",
  });
  await t.mutation(internal.testimonialImportVideo.attachAssistantUpload, {
    assetId: retryAsset._id,
    providerUploadId: "replacement-upload",
  });
  expect(
    await t.run(async (ctx) => (await ctx.db.get(retryAsset._id))?.status),
  ).toBe("processing");

  const overCapacity = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "capacity-selection",
    discoveredCount: 27,
    items: [
      { sourceId: "capacity-text", text: "The text still imports." },
      ...Array.from({ length: 26 }, (_, i) => ({
        sourceId: `capacity-video-${i}`,
        type: "video",
        videoUrl: `https://media.example/${i}.mp4`,
      })),
    ],
  });
  expect(overCapacity.structuredContent.result).toMatchObject({
    imported: 1,
    blocked: 26,
  });
  expect(
    overCapacity.structuredContent.outcomes.filter(
      (item: { status: string }) => item.status === "blocked",
    ),
  ).toHaveLength(26);
  await t.run(async (ctx) => {
    const items = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (q) =>
        q.eq("jobId", overCapacity.structuredContent.jobId),
      )
      .collect();
    for (const item of items.filter((item) => item.type === "video")) {
      expect(item.workflowId).toBeUndefined();
      const asset = await ctx.db.get(item.videoAssetId!);
      expect((await ctx.db.get(asset!.reservationId))?.status).toBe("released");
      expect((await ctx.db.get(item.testimonialId!))?.moderationStatus).toBe(
        "pending",
      );
    }
  });

  const other = await authenticatedUser(t, { email: "fern@example.com" });
  const otherProject = await other.client.mutation(api.organizations.create, {
    name: "Fern Studio",
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId,
        userId: other.actorId,
        scopes: ["testimonials:import"],
      },
    },
  });
  const { token: otherToken } = await sign(other.actorId);
  expect(
    (await call("list_assistant_import_projects", {}, otherToken)).isError,
  ).toBe(true);
  expect(
    (
      await call(
        "import_testimonial_text",
        { ...input, organizationId: otherProject.id },
        otherToken,
      )
    ).isError,
  ).toBe(true);
  await addStripeSubscription(t, otherProject.id, "active");
  expect(
    (
      await call(
        "read_assistant_import",
        { jobId: imported.structuredContent.jobId },
        otherToken,
      )
    ).isError,
  ).toBe(true);
  expect(
    (
      await call(
        "import_testimonial_text",
        { ...input, organizationId: project.id },
        otherToken,
      )
    ).isError,
  ).toBe(true);
  await addStripeSubscription(t, project.id, "canceled", {
    eventCreated: Math.floor(Date.now() / 1000) + 1,
  });
  const blockedItemId = overCapacity.structuredContent.outcomes.find(
    (item: { status: string }) => item.status === "blocked",
  ).itemId;
  await expect(
    owner.client.mutation(api.testimonialImportVideo.retry, {
      itemId: blockedItemId,
    }),
  ).rejects.toThrow();

  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [
        { field: "clientId", value: clientId },
        { field: "userId", value: owner.actorId },
      ],
      update: { scopes: [] },
    },
  });
  expect(
    (
      await call("read_assistant_import", {
        jobId: imported.structuredContent.jobId,
      })
    ).isError,
  ).toBe(true);
});
