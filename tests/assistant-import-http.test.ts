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
        scopes: ["testimonials:import:assistant"],
      },
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId,
        userId: owner.actorId,
        scopes: ["testimonials:import:assistant"],
      },
    },
  });
  const sign = (actorId: string, scope = "testimonials:import:assistant") =>
    t.run(async (ctx) => {
      const auth = await createImportOAuth(ctx);
      const now = Math.floor(Date.now() / 1000);
      return auth.api.signJWT({
        body: {
          payload: {
            sub: actorId,
            azp: clientId,
            scope,
            iat: now,
            exp: now + 900,
          },
        },
      });
    });
  const { token } = await sign(owner.actorId);
  let loseFinalResponse = false;
  let providerReject = false;
  let providerWrites = 0;
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    const target = new URL(url);
    if (target.hostname === "fake-mux.invalid") {
      providerWrites += 1;
      if (providerReject) return new Response(null, { status: 400 });
      if (loseFinalResponse)
        throw new TypeError("Final response lost after acceptance");
      const range = new Headers(init?.headers).get("content-range") ?? "";
      return new Response(null, { status: range.endsWith("/*") ? 308 : 200 });
    }
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
  const legacyToken = await sign(owner.actorId, "testimonials:import");
  expect(
    (await call("list_assistant_import_projects", {}, legacyToken.token))
      .isError,
  ).toBe(true);
  expect(
    (await call("list_assistant_import_projects", {})).structuredContent.page,
  ).toMatchObject([{ id: project.id }]);
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [{ field: "clientId", value: clientId }],
      update: { scopes: ["testimonials:import"] },
    },
  });
  expect((await call("list_assistant_import_projects", {})).isError).toBe(true);
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [{ field: "clientId", value: clientId }],
      update: { scopes: ["testimonials:import:assistant"] },
    },
  });
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

  const local = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "local-video",
    discoveredCount: 1,
    items: [
      { sourceId: "local-video", type: "video", authorName: "Camille Roche" },
    ],
  });
  expect(local.structuredContent.result.failed).toBe(1);
  const uploadInput = {
    jobId: local.structuredContent.jobId,
    itemId: local.structuredContent.outcomes[0].itemId,
    requestId: "local-upload-1",
    totalBytes: 4,
    mimeType: "video/mp4",
  };
  const upload = await call("create_assistant_video_upload", uploadInput);
  expect(upload.isError).not.toBe(true);
  const cap = upload.structuredContent;
  expect(
    (await call("create_assistant_video_upload", uploadInput)).structuredContent
      .uploadToken,
  ).toBe(cap.uploadToken);
  const sendPart = (range: string, bytes: number[], token = cap.uploadToken) =>
    t.fetch("/api/import-mcp/upload", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "video/mp4",
        "content-range": range,
      },
      body: new Uint8Array(bytes),
    });
  expect((await sendPart("bytes 0-1/4", [0, 1], "a".repeat(64))).status).toBe(
    409,
  );
  expect((await sendPart("bytes 2-3/4", [2, 3])).status).toBe(409);
  expect((await sendPart("bytes 0-1/4", [0, 1])).status).toBe(200);
  expect((await sendPart("bytes 0-1/4", [0, 1])).status).toBe(200);
  expect((await sendPart("bytes 0-1/4", [8, 9])).status).toBe(409);
  expect(
    (await call("create_assistant_video_upload", uploadInput)).structuredContent
      .offset,
  ).toBe(2);
  expect((await sendPart("bytes 2-3/4", [2, 3])).status).toBe(200);
  expect((await sendPart("bytes 2-3/4", [2, 3])).status).toBe(200);
  expect((await sendPart("bytes 2-3/4", [8, 9])).status).toBe(409);
  expect(
    (await call("create_assistant_video_upload", uploadInput))
      .structuredContent,
  ).toMatchObject({
    status: "complete",
    offset: 4,
    uploadToken: cap.uploadToken,
  });
  const uploadedAsset = await t.run(async (ctx) => {
    const item = await ctx.db.get(uploadInput.itemId);
    return (await ctx.db.get(item!.videoAssetId!))!;
  });
  expect(uploadedAsset).toMatchObject({
    status: "processing",
    fileSizeBytes: 4,
    importedFileVerified: true,
  });
  expect(
    (await call("read_assistant_import", { jobId: uploadInput.jobId }))
      .structuredContent.videos[0].status,
  ).toBe("processing");

  const interrupted = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "expired-local-video",
    discoveredCount: 1,
    items: [{ sourceId: "expired-local-video", type: "video" }],
  });
  const expiryInput = {
    ...uploadInput,
    jobId: interrupted.structuredContent.jobId,
    itemId: interrupted.structuredContent.outcomes[0].itemId,
    requestId: "expiring-upload",
  };
  const expiring = (await call("create_assistant_video_upload", expiryInput))
    .structuredContent;
  expect(
    (await sendPart("bytes 0-1/4", [0, 1], expiring.uploadToken)).status,
  ).toBe(200);
  const expiredRecord = await t.run(async (ctx) => {
    const upload = await ctx.db
      .query("assistantImportUploads")
      .withIndex("by_itemId_and_requestId", (q) =>
        q
          .eq("itemId", expiryInput.itemId)
          .eq("requestId", expiryInput.requestId),
      )
      .unique();
    await ctx.db.patch(upload!._id, { expiresAt: Date.now() - 1 });
    return upload!;
  });
  expect(
    (await sendPart("bytes 2-3/4", [2, 3], expiring.uploadToken)).status,
  ).toBe(409);
  await t.mutation(internal.assistantUploads.expire, { id: expiredRecord._id });
  await t.run(async (ctx) => {
    const asset = (await ctx.db.get(expiredRecord.assetId))!;
    expect(asset.status).toBe("failed");
    expect((await ctx.db.get(asset.reservationId))?.status).toBe("released");
    expect((await ctx.db.get(asset.testimonialId!))?.moderationStatus).toBe(
      "pending",
    );
  });

  const uncertain = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "uncertain-local-video",
    discoveredCount: 1,
    items: [{ sourceId: "uncertain-local-video", type: "video" }],
  });
  const uncertainInput = {
    ...uploadInput,
    jobId: uncertain.structuredContent.jobId,
    itemId: uncertain.structuredContent.outcomes[0].itemId,
    requestId: "uncertain-upload",
  };
  const uncertainCap = (
    await call("create_assistant_video_upload", uncertainInput)
  ).structuredContent;
  loseFinalResponse = true;
  const beforeFinal = providerWrites;
  expect(
    (await sendPart("bytes 0-3/4", [0, 1, 2, 3], uncertainCap.uploadToken))
      .status,
  ).toBe(202);
  expect(
    (await sendPart("bytes 0-3/4", [0, 1, 2, 3], uncertainCap.uploadToken))
      .status,
  ).toBe(202);
  expect(providerWrites).toBe(beforeFinal + 1);
  expect(
    (await call("create_assistant_video_upload", uncertainInput))
      .structuredContent.status,
  ).toBe("finalizing");
  loseFinalResponse = false;
  const uncertainRecord = await t.run(async (ctx) => {
    const upload = (await ctx.db
      .query("assistantImportUploads")
      .withIndex("by_itemId_and_requestId", (q) =>
        q
          .eq("itemId", uncertainInput.itemId)
          .eq("requestId", uncertainInput.requestId),
      )
      .unique())!;
    await ctx.db.patch(upload._id, { expiresAt: Date.now() - 1 });
    return upload;
  });
  await t.mutation(internal.assistantUploads.expire, {
    id: uncertainRecord._id,
  });
  const uncertainAsset = await t.run(async (ctx) => {
    const asset = (await ctx.db.get(uncertainRecord.assetId))!;
    expect(asset.status).toBe("processing");
    expect((await ctx.db.get(asset.reservationId))?.status).not.toBe(
      "released",
    );
    expect((await ctx.db.get(uncertainRecord._id))?.token).toBe("");
    return asset;
  });
  await t.mutation(internal.videoWebhooks.applyEvent, {
    event: {
      id: "late-local-ready",
      type: "video.asset.ready",
      data: {
        id: "late-local-asset",
        passthrough: uncertainAsset.reservationId,
        duration: 20,
        playback_ids: [{ id: "late-local-playback", policy: "public" }],
      },
    },
    retryTokenHash: "fixture-hash",
    retryTokenSeed: "fixture-seed",
  });
  expect(
    (await call("read_assistant_import", { jobId: uncertainInput.jobId }))
      .structuredContent.videos[0].status,
  ).toBe("ready");

  const rejected = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "rejected-local",
    discoveredCount: 1,
    items: [
      {
        sourceId: "rejected-local",
        type: "video",
        authorName: "Lina Moreau",
        text: "A lovely experience.",
      },
    ],
  });
  const rejectedInput = {
    ...uploadInput,
    jobId: rejected.structuredContent.jobId,
    itemId: rejected.structuredContent.outcomes[0].itemId,
    requestId: "rejected-upload",
  };
  const rejectedCap = await owner.client.action(
    api.assistantUploads.issueFromInbox,
    rejectedInput,
  );
  providerReject = true;
  expect(
    (await sendPart("bytes 0-3/4", [0, 1, 2, 3], rejectedCap.uploadToken))
      .status,
  ).toBe(422);
  providerReject = false;
  const websiteProgress = await owner.client.query(
    api.assistantImports.inboxStatus,
    { organizationId: project.id, jobId: rejectedInput.jobId },
  );
  expect(websiteProgress).toMatchObject({
    canUpload: true,
    items: [{ authorName: "Lina Moreau", videoStatus: "failed" }],
  });
  const replacementCap = await owner.client.action(
    api.assistantUploads.issueFromInbox,
    { ...rejectedInput, requestId: "replacement-upload" },
  );
  expect(replacementCap.uploadToken).not.toBe(rejectedCap.uploadToken);
  expect(
    (await sendPart("bytes 0-3/4", [0, 1, 2, 3], rejectedCap.uploadToken))
      .status,
  ).toBe(409);
  expect(
    (await sendPart("bytes 0-3/4", [0, 1, 2, 3], replacementCap.uploadToken))
      .status,
  ).toBe(200);
  await t.run(async (ctx) => {
    const item = (await ctx.db.get(rejectedInput.itemId))!;
    const testimonial = (await ctx.db.get(item.testimonialId!))!;
    expect(testimonial).toMatchObject({
      submitterName: "Lina Moreau",
      text: "A lovely experience.",
      moderationStatus: "pending",
    });
  });

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

  const fifty = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "fifty-retries",
    discoveredCount: 50,
    items: Array.from({ length: 50 }, (_, i) => ({
      sourceId: `fifty-${i}`,
      type: "video",
      videoUrl: `https://media.example/fifty-${i}.mp4`,
    })),
  });
  const fiftyRetry = await call("resume_assistant_import_videos", {
    jobId: fifty.structuredContent.jobId,
    itemIds: fifty.structuredContent.outcomes.map(
      (item: { itemId: string }) => item.itemId,
    ),
  });
  expect(JSON.stringify(fiftyRetry)).toContain("Video capacity changed.");

  const chosenVideos = overCapacity.structuredContent.outcomes.filter(
    (item: { status: string }) => item.status === "blocked",
  );
  expect(
    (
      await call("resume_assistant_import_videos", {
        jobId: overCapacity.structuredContent.jobId,
        itemIds: chosenVideos.map((item: { itemId: string }) => item.itemId),
      })
    ).isError,
  ).toBe(true);
  const resumedSelection = await call("resume_assistant_import_videos", {
    jobId: overCapacity.structuredContent.jobId,
    itemIds: chosenVideos
      .slice(-2)
      .map((item: { itemId: string }) => item.itemId),
  });
  expect(resumedSelection.isError).not.toBe(true);
  expect(resumedSelection.structuredContent.result).toMatchObject({
    processing: 2,
    blocked: 24,
  });
  expect(
    resumedSelection.structuredContent.availableVideoSlots,
  ).toBeGreaterThanOrEqual(0);

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
        scopes: ["testimonials:import:assistant"],
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
    (await call("create_assistant_video_upload", uploadInput, otherToken))
      .isError,
  ).toBe(true);
  await expect(
    other.client.action(api.assistantUploads.issueFromInbox, expiryInput),
  ).rejects.toThrow();

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
  const resumableJob = await call("import_testimonials", {
    organizationId: project.id,
    sourceUrl: input.sourceUrl,
    requestId: "resume-after-pro",
    discoveredCount: 1,
    items: [{ sourceId: "resume-after-pro", type: "video" }],
  });
  const resumableInput = {
    ...uploadInput,
    jobId: resumableJob.structuredContent.jobId,
    itemId: resumableJob.structuredContent.outcomes[0].itemId,
    requestId: "accepted-before-expiry",
  };
  const resumableCap = (
    await call("create_assistant_video_upload", resumableInput)
  ).structuredContent;
  expect(
    (await sendPart("bytes 0-1/4", [0, 1], resumableCap.uploadToken)).status,
  ).toBe(200);
  await addStripeSubscription(t, project.id, "canceled", {
    eventCreated: Math.floor(Date.now() / 1000) + 1,
  });
  expect(
    (await call("create_assistant_video_upload", resumableInput))
      .structuredContent,
  ).toMatchObject({ offset: 2, uploadToken: resumableCap.uploadToken });
  expect(
    await owner.client.action(
      api.assistantUploads.issueFromInbox,
      resumableInput,
    ),
  ).toMatchObject({ offset: 2, uploadToken: resumableCap.uploadToken });
  expect(
    (await sendPart("bytes 2-3/4", [2, 3], resumableCap.uploadToken)).status,
  ).toBe(200);
  expect(
    (
      await owner.client.query(api.assistantImports.inboxStatus, {
        organizationId: project.id,
        jobId: resumableInput.jobId,
      })
    )?.canUpload,
  ).toBe(false);
  await expect(
    owner.client.action(api.assistantUploads.issueFromInbox, {
      ...resumableInput,
      requestId: "new-after-expiry",
    }),
  ).rejects.toThrow();
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
