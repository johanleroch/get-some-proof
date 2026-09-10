import { withTestimonialIds } from "./testimonial-source-fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal, components } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function sourceFixture(count = 101) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          withTestimonialIds(
            Array.from(
              { length: count },
              (_, i) =>
                `<article class="testimonial-card text-testimonial"><span class="font-bold">Camille ${i}</span><div class="show-more-text">Original words ${i}.</div></article>`,
            ).join(""),
          ),
        ),
    ),
  );
}

it("keeps an uploaded visitor photo through edits, claim and confirmation", async () => {
  const t = createConvexTest();
  sourceFixture(1);
  const { token } = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/atelier-june/all" },
  );
  await t.action(api.importAvatarUpload.upload, {
    target: { token, position: 0 },
    bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
  });
  await t.mutation(api.anonymousWallImports.correctIdentity, {
    token,
    position: 0,
    authorName: "Camille Laurent",
    tagline: "Potter",
  });
  const preview = await t.query(api.anonymousWallImports.read, {
    token,
    offset: 0,
  });
  expect(preview!.items[0]!.avatarUrl).toContain("/api/storage/");
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  const { jobId } = await owner.client.mutation(
    api.anonymousWallImports.claim,
    { token, organizationId: project.id },
  );
  const owned = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const item = owned!.items.page[0]!;
  expect(item.avatarUrl).toBe(preview!.items[0]!.avatarUrl);
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: [item._id],
  });
  const savedItem = (await t.run((ctx) => ctx.db.get(item._id)))!;
  expect(
    (await t.run((ctx) => ctx.db.get(savedItem.testimonialId!)))
      ?.avatarStorageId,
  ).toBe(item.identityCorrection!.avatarStorageId);
  await expect(
    t.action(api.importAvatarUpload.upload, {
      target: { token, position: 0 },
      bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
    }),
  ).rejects.toThrow();
});

it("previews before signup, resumes selection and claims once into an owned Project", async () => {
  const t = createConvexTest();
  sourceFixture();
  const { token } = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/atelier-june/all" },
  );
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const first = await t.query(api.anonymousWallImports.read, {
    token,
    offset: 0,
  });
  expect(first?.items).toHaveLength(100);
  expect(first?.nextOffset).toBe(100);
  const last = await t.query(api.anonymousWallImports.read, {
    token,
    offset: 100,
  });
  expect(last?.items).toHaveLength(1);
  expect(last?.nextOffset).toBeNull();
  await t.mutation(api.anonymousWallImports.select, {
    token,
    positions: [0, 100],
  });
  expect(
    (await t.query(api.anonymousWallImports.read, { token, offset: 100 }))
      ?.selectedPositions,
  ).toEqual([0, 100]);
  const stored = await t.run((ctx) =>
    ctx.db.query("anonymousWallPreviews").unique(),
  );
  expect(JSON.stringify(stored)).not.toContain(token);
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  const pageArgs = { paginationOpts: { cursor: null, numItems: 20 } };
  await expect(
    t.query(api.anonymousWallImports.destinations, pageArgs),
  ).rejects.toThrow();
  expect(
    (await owner.client.query(api.anonymousWallImports.destinations, pageArgs))
      .page,
  ).toEqual([{ id: project.id, name: "Atelier June", slug: project.slug }]);
  await expect(
    owner.client.query(api.anonymousWallImports.destinations, {
      paginationOpts: { cursor: null, numItems: 21 },
    }),
  ).rejects.toMatchObject({ data: { code: "INVALID_PAGE_SIZE" } });
  const claim = { token, organizationId: project.id };
  await expect(
    t.mutation(api.anonymousWallImports.claim, claim),
  ).rejects.toThrow();
  const result = await owner.client.mutation(
    api.anonymousWallImports.claim,
    claim,
  );
  expect(
    await owner.client.mutation(api.anonymousWallImports.claim, claim),
  ).toEqual(result);
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId: result.jobId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  expect(preview?.selectedItemIds).toHaveLength(2);
  expect(await t.run((ctx) => ctx.db.query("testimonials").collect())).toEqual(
    [],
  );
  expect(
    await t.query(api.anonymousWallImports.read, { token, offset: 0 }),
  ).toBeNull();
  const claimed = await t.run((ctx) =>
    ctx.db.query("anonymousWallPreviews").unique(),
  );
  expect(claimed?.items).toEqual([]);
  const other = await authenticatedUser(t, { email: "other@example.com" });
  const otherProject = await other.client.mutation(api.organizations.create, {
    name: "Fernhill Studio",
  });
  expect(
    (await other.client.query(api.anonymousWallImports.destinations, pageArgs))
      .page,
  ).toEqual([
    { id: otherProject.id, name: "Fernhill Studio", slug: otherProject.slug },
  ]);
  expect(await t.query(api.anonymousWallImports.resume, { token })).toBeNull();
  expect(
    await other.client.query(api.anonymousWallImports.resume, { token }),
  ).toBeNull();
  expect(
    await owner.client.query(api.anonymousWallImports.resume, { token }),
  ).toMatchObject({ jobId: result.jobId, organizationSlug: project.slug });
  await expect(
    other.client.mutation(api.anonymousWallImports.claim, {
      token,
      organizationId: otherProject.id,
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_UNAVAILABLE" } });
  await t.run((ctx) =>
    ctx.db.patch(otherProject.id, { deletionStartedAt: Date.now() }),
  );
  expect(
    (await other.client.query(api.anonymousWallImports.destinations, pageArgs))
      .page,
  ).toEqual([]);
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId: result.jobId,
    itemIds: preview!.selectedItemIds,
  });
  const proofs = await t.run((ctx) => ctx.db.query("testimonials").collect());
  expect(proofs).toHaveLength(2);
  expect(proofs.map((proof) => proof.text).sort()).toEqual([
    "Original words 0.",
    "Original words 100.",
  ]);
  expect(proofs.every((proof) => proof.moderationStatus === "pending")).toBe(
    true,
  );
  const date = new Date(Date.now()).toISOString().slice(0, 10);
  const report = () =>
    t.query(internal.importAcquisition.report, { from: date, through: date });
  expect(
    (await report()).map(({ stage, count, channel }) => ({
      stage,
      count,
      channel,
    })),
  ).toEqual(
    ["claimed", "previewed", "saved", "started"].map((stage) => ({
      stage,
      count: 1,
      channel: "public-web",
    })),
  );
  for (const proof of proofs) {
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: project.id,
      testimonialId: proof._id,
      status: "published",
      importAttestationAccepted: true,
      importAttestationVersion: "2026-09-09",
    });
  }
  expect((await report()).find((row) => row.stage === "published")?.count).toBe(
    1,
  );
  const aggregate = JSON.stringify(await report());
  expect(aggregate).not.toContain("Camille");
  expect(aggregate).not.toContain("atelier-june");
  expect(aggregate).not.toContain(token);
  const flow = await t.run((ctx) =>
    ctx.db.query("importAcquisitionFlows").unique(),
  );
  expect(Object.keys(flow!).sort()).toEqual(
    ["_creationTime", "_id", "channel", "expiresAt", "stages"].sort(),
  );
  await t.run((ctx) => ctx.db.patch(flow!._id, { expiresAt: Date.now() - 1 }));
  await t.mutation(internal.importAcquisition.expire, { flowId: flow!._id });
  expect(await t.run((ctx) => ctx.db.get(flow!._id))).toBeNull();
  expect((await report()).find((row) => row.stage === "published")?.count).toBe(
    1,
  );
  await expect(
    t.query(internal.importAcquisition.report, {
      from: "2026-01-01",
      through: "2026-03-01",
    }),
  ).rejects.toThrow();
});

it("rejects invalid selection, expired claims and unknown tokens, then purges the snapshot", async () => {
  const t = createConvexTest();
  sourceFixture(1);
  const { token } = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/atelier-june/all" },
  );
  await expect(
    t.mutation(api.anonymousWallImports.select, { token, positions: [1] }),
  ).rejects.toMatchObject({ data: { code: "INVALID_SELECTION" } });
  expect(
    await t.query(api.anonymousWallImports.read, {
      token: "invalid",
      offset: 0,
    }),
  ).toBeNull();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  const stored = await t.run((ctx) =>
    ctx.db.query("anonymousWallPreviews").unique(),
  );
  await t.run((ctx) =>
    ctx.db.patch(stored!._id, { expiresAt: Date.now() - 1 }),
  );
  await expect(
    owner.client.mutation(api.anonymousWallImports.claim, {
      token,
      organizationId: project.id,
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_UNAVAILABLE" } });
  await t.mutation(internal.anonymousWallImports.expire, {
    previewId: stored!._id,
  });
  expect(
    await t.query(api.anonymousWallImports.read, { token, offset: 0 }),
  ).toBeNull();
});

it("saves an OAuth selection once, preserves Pending and rejects revoked consent", async () => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  const t = createConvexTest();
  sourceFixture(2);
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const clientId = "import-save-fixture";
  for (const input of [
    {
      model: "importOAuthClient" as const,
      data: {
        clientId,
        scopes: ["testimonials:import"],
        redirectUris: ["https://client.example/callback"],
      },
    },
    {
      model: "importOAuthConsent" as const,
      data: {
        clientId,
        userId: owner.actorId,
        scopes: ["testimonials:import"],
      },
    },
  ])
    await t.mutation(components.betterAuth.adapter.create, { input });
  const grant = {
    actorId: owner.actorId,
    clientId,
    issuedAt: Date.now(),
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 900_000,
  };
  const destinationArgs = {
    grant,
    paginationOpts: { numItems: 20, cursor: null },
  };
  vi.stubEnv("MUX_PROVIDER", "fake");
  const destinations = await t.query(
    internal.importOAuthCommands.destinations,
    destinationArgs,
  );
  expect(destinations.page).toEqual([
    expect.objectContaining({
      id: project.id,
      videoCapacity: { used: 0, limit: 2, available: true, configured: true },
    }),
  ]);
  vi.stubEnv("MUX_PROVIDER", "");
  expect(
    (await t.query(internal.importOAuthCommands.destinations, destinationArgs))
      .page[0].videoCapacity.configured,
  ).toBe(false);
  const reservationIds = await t.run(async (ctx) => {
    const accountId = (await ctx.db.get(project.id))!.accountId;
    return Promise.all(
      [0, 1].map((index) =>
        ctx.db.insert("videoReservations", {
          accountId,
          organizationId: project.id,
          clientSubmissionId: `capacity-${index}`,
          plan: "free",
          status: "reserved",
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      ),
    );
  });
  expect(
    (await t.query(internal.importOAuthCommands.destinations, destinationArgs))
      .page[0].videoCapacity,
  ).toEqual({ used: 2, limit: 2, available: false, configured: false });
  await t.run(async (ctx) => {
    for (const id of reservationIds)
      await ctx.db.patch(id, { status: "released" });
  });
  const { token } = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/willow/all", channel: "chatgpt" },
  );
  await t.mutation(api.anonymousWallImports.select, { token, positions: [1] });
  const args = { grant, token, organizationId: project.id };
  expect(
    await t.mutation(internal.importOAuthCommands.eligibility, args),
  ).toMatchObject({
    selected: 1,
    text: 1,
    video: 0,
    duplicates: 0,
    eligibleKeys: ["1"],
  });
  expect(
    await t.query(api.anonymousWallImports.read, { token, offset: 0 }),
  ).not.toBeNull();
  const other = await authenticatedUser(t, {
    email: "maya@juniper.example",
    name: "Maya Laurent",
  });
  const otherProject = await other.client.mutation(api.organizations.create, {
    name: "Juniper Studio",
  });
  await expect(
    t.mutation(internal.importOAuthCommands.save, {
      ...args,
      organizationId: otherProject.id,
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(internal.importOAuthCommands.eligibility, {
      ...args,
      organizationId: otherProject.id,
    }),
  ).rejects.toThrow();
  const saved = await t.mutation(internal.importOAuthCommands.save, args);
  expect(saved.result.imported).toBe(1);
  expect(await t.mutation(internal.importOAuthCommands.save, args)).toEqual(
    saved,
  );
  const testimonials = await t.run((ctx) =>
    ctx.db.query("testimonials").collect(),
  );
  expect(testimonials).toHaveLength(1);
  expect(testimonials[0]).toMatchObject({
    moderationStatus: "pending",
    text: "Original words 1.",
    importOrigin: { importedBy: owner.actorId },
  });
  expect(testimonials[0]).not.toHaveProperty("consent");
  const nextPreview = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/willow/all", channel: "chatgpt" },
  );
  await t.mutation(api.anonymousWallImports.select, {
    token: nextPreview.token,
    positions: [1],
  });
  expect(
    await t.mutation(internal.importOAuthCommands.eligibility, {
      ...args,
      token: nextPreview.token,
    }),
  ).toMatchObject({
    selected: 1,
    text: 0,
    duplicates: 1,
    eligibleKeys: [],
  });
  const statusArgs = { grant, jobId: saved.jobId };
  expect(
    await t.query(internal.importOAuthCommands.status, statusArgs),
  ).toEqual({
    ...saved,
    photos: [],
    videos: [],
  });
  const { itemId, otherJobId } = await t.run(async (ctx) => {
    const job = (await ctx.db.get(saved.jobId))!;
    const otherJobId = await ctx.db.insert("testimonialImportJobs", {
      organizationId: otherProject.id,
      createdBy: other.actorId,
      provider: job.provider,
      sourceUrl: job.sourceUrl,
      itemCount: 0,
      createdAt: Date.now(),
      expiresAt: job.expiresAt,
      result: saved.result,
    });
    const testimonialId = await ctx.db.insert("testimonials", {
      organizationId: project.id,
      clientSubmissionId: "oauth-status-video",
      submissionType: "video",
      moderationStatus: "pending",
      submitterName: "Camille Roche",
      text: "Our customers find us more easily.",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const itemId = await ctx.db.insert("testimonialImportItems", {
      organizationId: project.id,
      jobId: saved.jobId,
      position: 2,
      sourceId: "video-camille",
      type: "video",
      authorName: "Camille Roche",
      text: "Our customers find us more easily.",
      videoUrl: "https://stream.mux.com/camille/high.mp4",
      videoStatus: "processing",
      testimonialId,
    });
    await ctx.db.patch(saved.jobId, {
      result: { ...saved.result, processing: 1 },
    });
    return { itemId, otherJobId };
  });
  const retryArgs = { ...statusArgs, itemId };
  expect(
    (await t.query(internal.importOAuthCommands.status, statusArgs)).videos,
  ).toEqual([{ itemId, authorName: "Camille Roche", status: "processing" }]);
  await expect(
    t.query(internal.importOAuthCommands.status, {
      ...statusArgs,
      jobId: otherJobId,
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(internal.importOAuthCommands.retryVideo, {
      ...retryArgs,
      jobId: otherJobId,
    }),
  ).rejects.toMatchObject({ data: { code: "IMPORT_UNAVAILABLE" } });
  expect(
    await t.mutation(internal.importOAuthCommands.retryVideo, retryArgs),
  ).toBeNull();
  await t.run(async (ctx) => {
    await ctx.db.patch(itemId, {
      videoStatus: "failed",
      failureReason: "private provider diagnostic https://secret.example/token",
    });
    await ctx.db.patch(saved.jobId, {
      result: { ...saved.result, processing: 0, failed: 1 },
    });
  });
  expect(
    (await t.query(internal.importOAuthCommands.status, statusArgs)).videos[0]
      .status,
  ).toBe("failed");
  expect(
    (await t.query(internal.importOAuthCommands.status, statusArgs)).videos[0]
      .failureMessage,
  ).toBe("Video processing failed. Check the source video and try again.");
  await t.run((ctx) =>
    ctx.db.patch(itemId, {
      failureReason: "Video must be no longer than 2 minutes.",
    }),
  );
  expect(
    (await t.query(internal.importOAuthCommands.status, statusArgs)).videos[0]
      .failureMessage,
  ).toBe(
    "This copy failed under the previous 2-minute limit. Retry to apply the current 10-minute import limit.",
  );
  await expect(
    t.mutation(internal.importOAuthCommands.retryVideo, retryArgs),
  ).rejects.toMatchObject({ data: { code: "VIDEO_CAPACITY_REACHED" } });
  vi.stubEnv("MUX_PROVIDER", "fake");
  await t.mutation(internal.importOAuthCommands.retryVideo, retryArgs);
  await t.mutation(internal.importOAuthCommands.retryVideo, retryArgs);
  const retried = await t.query(
    internal.importOAuthCommands.status,
    statusArgs,
  );
  expect(retried.result).toMatchObject({ processing: 1, failed: 0 });
  expect(retried.videos).toEqual([
    { itemId, authorName: "Camille Roche", status: "processing" },
  ]);
  expect(
    await t.run((ctx) => ctx.db.query("videoAssets").collect()),
  ).toHaveLength(1);
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [{ field: "clientId", value: clientId }],
      update: { scopes: [] },
    },
  });
  await expect(
    t.mutation(internal.importOAuthCommands.save, args),
  ).rejects.toMatchObject({ data: { code: "IMPORT_AUTH_REQUIRED" } });
  await expect(
    t.query(internal.importOAuthCommands.status, statusArgs),
  ).rejects.toMatchObject({ data: { code: "IMPORT_AUTH_REQUIRED" } });
  await expect(
    t.mutation(internal.importOAuthCommands.retryVideo, retryArgs),
  ).rejects.toMatchObject({ data: { code: "IMPORT_AUTH_REQUIRED" } });
});

it("keeps corrected preview identity separate from source through claim and import", async () => {
  const t = createConvexTest();
  sourceFixture(2);
  const { token } = await t.action(
    api.testimonialImportSource.previewAnonymous,
    { url: "https://testimonial.to/atelier-june/all" },
  );
  await t.mutation(api.anonymousWallImports.select, { token, positions: [0] });
  const correction = {
    token,
    position: 0,
    authorName: " Camille Laurent ",
    tagline: " Founder, Atelier June ",
  };
  await expect(
    t.mutation(api.anonymousWallImports.correctIdentity, {
      ...correction,
      token: "a".repeat(64),
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_UNAVAILABLE" } });
  for (const invalid of [
    { authorName: " " },
    { tagline: "x".repeat(201) },
    { position: -1 },
    { position: 2 },
    { position: 0.5 },
  ])
    await expect(
      t.mutation(api.anonymousWallImports.correctIdentity, {
        ...correction,
        ...invalid,
      }),
    ).rejects.toThrow();
  await t.mutation(api.anonymousWallImports.correctIdentity, correction);
  const read = await t.query(api.anonymousWallImports.read, {
    token,
    offset: 0,
  });
  expect(read?.selectedPositions).toEqual([0]);
  expect(read?.items[0]).toMatchObject({
    authorName: "Camille Laurent",
    tagline: "Founder, Atelier June",
    text: "Original words 0.",
  });
  const raw = await t.run((ctx) =>
    ctx.db.query("anonymousWallPreviews").unique(),
  );
  expect(raw?.items[0]?.authorName).toBe("Camille 0");
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Atelier June",
  });
  const { jobId } = await owner.client.mutation(
    api.anonymousWallImports.claim,
    { token, organizationId: project.id },
  );
  const preview = await owner.client.query(api.testimonialImports.getPreview, {
    jobId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(preview?.items.page[0]).toMatchObject({
    authorName: "Camille 0",
    identityCorrection: {
      authorName: "Camille Laurent",
      tagline: "Founder, Atelier June",
    },
  });
  await owner.client.mutation(api.testimonialImports.confirm, {
    jobId,
    itemIds: preview!.selectedItemIds,
  });
  const proof = await t.run((ctx) => ctx.db.query("testimonials").unique());
  expect(proof).toMatchObject({
    submitterName: "Camille Laurent",
    importOrigin: {
      originalAuthorName: "Camille 0",
      originalText: "Original words 0.",
    },
    moderationStatus: "pending",
  });
  expect(
    (await t.run((ctx) => ctx.db.query("anonymousWallPreviews").unique()))
      ?.identityCorrections,
  ).toBeUndefined();
  await expect(
    t.mutation(api.anonymousWallImports.correctIdentity, correction),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_UNAVAILABLE" } });
  const fresh = await t.action(api.testimonialImportSource.previewAnonymous, {
    url: "https://testimonial.to/atelier-june/all",
  });
  vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
  await expect(
    t.mutation(api.anonymousWallImports.correctIdentity, {
      ...correction,
      token: fresh.token,
    }),
  ).rejects.toMatchObject({ data: { code: "PREVIEW_UNAVAILABLE" } });
});
