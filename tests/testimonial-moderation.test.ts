import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import {
  addStripeSubscription,
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

const text =
  "Get Some Proof made collecting customer feedback simple and clear.";

async function createPendingTestimonial(
  t: ReturnType<typeof createConvexTest>,
  publicSlug: string,
  clientSubmissionId: string,
) {
  const consent = buildPublicationConsent({
    brandName: "Acme Studio",
    privacyContact: "privacy@acme.example",
    suppliedIdentity: {
      avatarSupplied: false,
      company: "Example Studio",
      name: "Camille Test",
      rating: 5,
      role: "Founder",
    },
  });
  return t.mutation(internal.submissions.createTextRecords, {
    ageConfirmed: true,
    clientSubmissionId,
    company: "Example Studio",
    consentAccepted: true,
    consentText: consent.text,
    consentVersion: consent.version,
    deliveryAttemptId: `delivery-${clientSubmissionId}`,
    managementTokenHash: clientSubmissionId.padEnd(64, "a").slice(0, 64),
    publicSlug,
    rating: 5,
    role: "Founder",
    submitterEmail: "camille@example.invalid",
    submitterName: "Camille Test",
    text,
  });
}

describe("Testimonial moderation and Public Projection", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "test-ingest-secret-with-at-least-32-characters",
    );
  });

  it("publishes only Ready video proof through a public-safe projection", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "moderated-video-proof",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: {
        avatarSupplied: false,
        company: "Example Studio",
        name: "Camille Test",
        rating: 5,
        role: "Founder",
      },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "moderated-video-proof",
      company: "Example Studio",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 42,
      rating: 5,
      reservationId: upload.reservationId,
      role: "Founder",
      submitterEmail: "private@example.invalid",
      submitterName: "Camille Test",
    });

    const processingInbox = await owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        submissionType: "video",
      },
    );
    expect(processingInbox.page).toEqual([
      expect.objectContaining({
        captionsStatus: "requested",
        moderationStatus: "pending",
        submissionType: "video",
        videoStatus: "awaiting_upload",
      }),
    ]);
    await expect(
      owner.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: brand.id,
        status: "published",
        testimonialId: submitted.testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "VIDEO_NOT_READY" } });

    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: {
          duration: 42,
          id: "ready-video-asset",
          passthrough: upload.reservationId,
          playback_ids: [{ id: "public-playback-id", policy: "public" }],
        },
        id: "ready-video-event",
        type: "video.asset.ready",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: { asset_id: "ready-video-asset" },
        id: "caption-failed-event",
        type: "video.asset.track.errored",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: submitted.testimonialId,
    });
    await expect(
      owner.client.query(api.testimonialModeration.listInbox, {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        submissionType: "video",
      }),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ canDownload: false })],
    });
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_inbox_download");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_inbox_download");
    await addStripeSubscription(t, brand.id, "active");
    await expect(
      owner.client.query(api.testimonialModeration.listInbox, {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        submissionType: "video",
      }),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ canDownload: true })],
    });

    const wall = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    expect(wall.page).toEqual([
      {
        avatarUrl: null,
        avatarVisible: true,
        captionsAvailable: false,
        company: "Example Studio",
        id: expect.any(String),
        name: "Camille Test",
        playbackId: "public-playback-id",
        posterTimeSeconds: 21,
        publishedAt: expect.any(Number),
        rating: 5,
        role: "Founder",
        type: "video",
      },
    ]);
    expect(JSON.stringify(wall)).not.toContain("private@example.invalid");
    expect(JSON.stringify(wall)).not.toContain("organizationId");
    expect(JSON.stringify(wall)).not.toContain("viewer");

    await t.action(api.videoWebhooks.ingest, {
      event: {
        data: { asset_id: "ready-video-asset", id: "late-caption-track" },
        id: "late-caption-ready-event",
        type: "video.asset.track.ready",
      },
      ingestSecret: "test-ingest-secret-with-at-least-32-characters",
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ captionsAvailable: true })],
    });
  });

  it("lists private Inbox data only for the active Brand and supports filters and sort", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const first = await createPendingTestimonial(
      t,
      "acme-proof",
      "first-submission",
    );
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createPendingTestimonial(
      t,
      "acme-proof",
      "second-submission",
    );

    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "archived",
      testimonialId: first.testimonialId,
    });

    const firstPage = await owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 1 },
        sort: "oldest",
      },
    );
    expect(firstPage).toMatchObject({
      isDone: false,
      page: [
        expect.objectContaining({
          moderationStatus: "archived",
          submitterEmail: "camille@example.invalid",
          testimonialId: first.testimonialId,
        }),
      ],
    });
    await expect(
      owner.client.query(api.testimonialModeration.listInbox, {
        organizationId: brand.id,
        paginationOpts: {
          cursor: firstPage.continueCursor,
          numItems: 1,
        },
        sort: "oldest",
      }),
    ).resolves.toMatchObject({
      isDone: true,
      page: [expect.objectContaining({ testimonialId: second.testimonialId })],
    });
    const pendingPage = await owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        status: "pending",
        submissionType: "text",
      },
    );
    expect(pendingPage.page).toEqual([
      expect.objectContaining({ testimonialId: second.testimonialId }),
    ]);
  });

  it("publishes only consented public-safe fields and audits every transition", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      primaryColor: "#123abc",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const created = await createPendingTestimonial(
      t,
      "acme-proof",
      "publish-submission",
    );

    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: created.testimonialId,
    });
    const brandInfo = await t.query(api.publicWall.getBrand, {
      publicSlug: "acme-proof",
    });
    const wallPage = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    const wall = brandInfo && { ...brandInfo, testimonials: wallPage.page };

    expect(wall).toEqual({
      accentColor: "#123abc",
      attributionRequired: true,
      brandName: "Acme Studio",
      hasPublishedTestimonials: true,
      publicSlug: "acme-proof",
      theme: "system",
      testimonials: [
        {
          avatarUrl: null,
          avatarVisible: true,
          company: "Example Studio",
          id: expect.any(String),
          name: "Camille Test",
          publishedAt: expect.any(Number),
          rating: 5,
          role: "Founder",
          text,
          type: "text",
        },
      ],
      transparentEmbed: false,
    });
    expect(JSON.stringify(wall)).not.toContain("camille@example.invalid");
    expect(JSON.stringify(wall)).not.toContain("organizationId");
    expect(JSON.stringify(wall)).not.toContain("consent");
    expect(JSON.stringify(wall)).not.toContain("moderationStatus");

    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "archived",
      testimonialId: created.testimonialId,
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_organization_occurred_at", (index) =>
          index.eq("organizationId", brand.id),
        )
        .collect(),
    );
    expect(events.map(({ eventType }) => eventType)).toEqual(
      expect.arrayContaining(["testimonial.published", "testimonial.archived"]),
    );
  });

  it("paginates every published Testimonial without hiding older proof", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const older = await createPendingTestimonial(
      t,
      "acme-proof",
      "older-public-submission",
    );
    const newer = await createPendingTestimonial(
      t,
      "acme-proof",
      "newer-public-submission",
    );
    for (const testimonialId of [older.testimonialId, newer.testimonialId]) {
      await owner.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: brand.id,
        status: "published",
        testimonialId,
      });
    }

    const firstPage = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 1 },
      publicSlug: "acme-proof",
    });
    expect(firstPage).toMatchObject({
      isDone: false,
      page: [expect.objectContaining({ id: expect.any(String) })],
    });
    const secondPage = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: firstPage.continueCursor, numItems: 1 },
      publicSlug: "acme-proof",
    });
    expect(secondPage).toMatchObject({
      isDone: true,
      page: [expect.objectContaining({ id: expect.any(String) })],
    });
    expect(firstPage.page[0]?.id).not.toBe(secondPage.page[0]?.id);
  });

  it("rejects cross-Brand moderation and invalid state transitions", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const aliceBrand = await alice.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const created = await createPendingTestimonial(
      t,
      "acme-proof",
      "protected-submission",
    );
    const bob = await authenticatedUser(t, {
      email: "bob@example.invalid",
      name: "Bob Owner",
    });
    const bobBrand = await bob.client.mutation(api.organizations.create, {
      name: "Bob Studio",
      publicSlug: "bob-proof",
    });

    await expect(
      bob.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: bobBrand.id,
        status: "published",
        testimonialId: created.testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "TESTIMONIAL_UNAVAILABLE" } });

    await alice.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: aliceBrand.id,
      status: "archived",
      testimonialId: created.testimonialId,
    });
    await expect(
      alice.client.mutation(api.testimonialModeration.setStatus, {
        organizationId: aliceBrand.id,
        status: "pending",
        testimonialId: created.testimonialId,
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_MODERATION_TRANSITION" },
    });
  });

  it.each(["admin", "editor", "viewer"] as const)(
    "keeps Inbox reads, moderation, and deletion Owner-only for the %s role",
    async (role) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const brand = await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        privacyContact: "privacy@acme.example",
        publicSlug: "acme-proof",
      });
      const created = await createPendingTestimonial(
        t,
        "acme-proof",
        `${role}-protected-submission`,
      );
      const member = await authenticatedUser(t, {
        email: `${role}@example.invalid`,
        name: `${role} Member`,
      });
      await addMemberWithRole(t, brand.id, member.actorId, role);

      const accessDenied = {
        data: { code: "ORGANIZATION_ACCESS_DENIED" },
      };
      await expect(
        member.client.query(api.testimonialModeration.listInbox, {
          organizationId: brand.id,
          paginationOpts: { cursor: null, numItems: 20 },
          sort: "newest",
        }),
      ).rejects.toMatchObject(accessDenied);
      await expect(
        member.client.mutation(api.testimonialModeration.setStatus, {
          organizationId: brand.id,
          status: "published",
          testimonialId: created.testimonialId,
        }),
      ).rejects.toMatchObject(accessDenied);
      await expect(
        member.client.mutation(api.testimonialModeration.remove, {
          organizationId: brand.id,
          testimonialId: created.testimonialId,
        }),
      ).rejects.toMatchObject(accessDenied);
    },
  );

  it("permanently deletes private records and removes published proof immediately", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const created = await createPendingTestimonial(
      t,
      "acme-proof",
      "delete-submission",
    );
    const avatarStorageId = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["private avatar"]));
      await ctx.db.patch(storageId, { contentType: "image/jpeg" });
      await ctx.db.patch(created.testimonialId, { avatarStorageId: storageId });
      return storageId;
    });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: created.testimonialId,
    });

    await owner.client.mutation(api.testimonialModeration.remove, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    await expect(
      owner.client.mutation(api.testimonialModeration.remove, {
        organizationId: brand.id,
        testimonialId: created.testimonialId,
      }),
    ).resolves.toEqual({ deleted: true });

    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });
    const remaining = await t.run(async (ctx) => ({
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", brand.id)
            .eq("targetType", "testimonial")
            .eq("targetId", String(created.testimonialId)),
        )
        .collect(),
      avatar: await ctx.db.system.get("_storage", avatarStorageId),
      credit: await ctx.db
        .query("collectionCredits")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", created.testimonialId),
        )
        .unique(),
      consents: await ctx.db.query("publicationConsents").collect(),
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(remaining).toEqual({
      audits: expect.arrayContaining([
        expect.objectContaining({
          eventType: "testimonial.deleted",
          targetLabel: "Deleted Testimonial",
        }),
      ]),
      avatar: null,
      credit: expect.objectContaining({
        testimonialId: created.testimonialId,
      }),
      consents: [],
      deliveries: [],
      projections: [],
      testimonials: [],
    });
    expect(remaining.audits.map((event) => event.targetLabel)).not.toContain(
      "Camille Test",
    );
    expect(remaining.audits).toHaveLength(1);
    expect(remaining.credit).not.toHaveProperty("restoredAt");
  });

  it("removes a prior Spam quarantine after undo and permanent deletion", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, "owner-delete-spam");
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "delete-spam-brand",
    });
    const created = await createPendingTestimonial(
      t,
      "delete-spam-brand",
      "delete-spam-history",
    );

    await owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    await owner.client.mutation(api.testimonialModeration.undoSpam, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 40; index += 1) {
        await ctx.db.insert("spamQuarantines", {
          creditRestored: false,
          expiresAt: Date.now() - index,
          organizationId: brand.id,
          previousModerationStatus: "pending",
          reportedAt: Date.now() - index,
          status: "undone",
          testimonialId: created.testimonialId,
          updatedAt: Date.now(),
        });
      }
    });
    await owner.client.mutation(api.testimonialModeration.remove, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    await t.mutation(
      internal.testimonialDeletion.continueTestimonialRelationshipPurge,
      {
        includeVideoRelations: false,
        organizationId: brand.id,
        testimonialId: created.testimonialId,
      },
    );

    const remaining = await t.run(async (ctx) => ({
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", brand.id)
            .eq("targetType", "testimonial")
            .eq("targetId", String(created.testimonialId)),
        )
        .collect(),
      quarantines: await ctx.db
        .query("spamQuarantines")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", created.testimonialId),
        )
        .collect(),
    }));
    expect(remaining.quarantines).toEqual([]);
    expect(remaining.audits).toHaveLength(1);
    expect(remaining.audits[0]).toMatchObject({
      eventType: "testimonial.deleted",
      targetLabel: "Deleted Testimonial",
    });
  });

  it("restores only the first three rolling Spam credits and consumes one again on undo", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const testimonials = [];
    for (let index = 0; index < 4; index += 1) {
      testimonials.push(
        await createPendingTestimonial(
          t,
          "acme-proof",
          `spam-submission-${index}`,
        ),
      );
    }

    const reports = [];
    for (const testimonial of testimonials) {
      reports.push(
        await owner.client.mutation(api.testimonialModeration.markSpam, {
          organizationId: brand.id,
          testimonialId: testimonial.testimonialId,
        }),
      );
    }
    expect(reports.map(({ creditRestored }) => creditRestored)).toEqual([
      true,
      true,
      true,
      false,
    ]);

    await owner.client.mutation(api.testimonialModeration.undoSpam, {
      organizationId: brand.id,
      testimonialId: testimonials[0]!.testimonialId,
    });
    const credits = await t.run((ctx) =>
      ctx.db
        .query("collectionCredits")
        .withIndex("by_organization_type", (index) =>
          index.eq("organizationId", brand.id).eq("submissionType", "text"),
        )
        .collect(),
    );
    expect(
      credits.filter((credit) => credit.restoredAt === undefined),
    ).toHaveLength(2);
    expect(
      credits.filter((credit) => credit.restoredAt !== undefined),
    ).toHaveLength(2);

    const fourthQuarantine = await t.run((ctx) =>
      ctx.db
        .query("spamQuarantines")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonials[3]!.testimonialId),
        )
        .unique(),
    );
    await expect(
      t.mutation(internal.testimonialModeration.approveSpamCreditRestoration, {
        actorDisplayName: "Johan Support",
        quarantineId: fourthQuarantine!._id,
      }),
    ).resolves.toEqual({ restored: true });
    await expect(
      t.run((ctx) => ctx.db.get(fourthQuarantine!._id)),
    ).resolves.toMatchObject({
      creditRestored: true,
      restorationMode: "support",
      supportActor: "Johan Support",
    });
    await expect(
      t.mutation(internal.testimonialModeration.approveSpamCreditRestoration, {
        actorDisplayName: "Another Support",
        quarantineId: fourthQuarantine!._id,
      }),
    ).resolves.toEqual({ restored: false });
    const supportEvents = await t.run((ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", brand.id)
            .eq("targetType", "testimonial")
            .eq("targetId", String(testimonials[3]!.testimonialId)),
        )
        .collect(),
    );
    expect(
      supportEvents.filter(
        (event) => event.eventType === "testimonial.spam_credit_restored",
      ),
    ).toHaveLength(1);
  });

  it("allows a new automatic restoration after the rolling window expires", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    for (let index = 0; index < 3; index++) {
      const item = await createPendingTestimonial(
        t,
        "acme-proof",
        `old-spam-${index}`,
      );
      await owner.client.mutation(api.testimonialModeration.markSpam, {
        organizationId: brand.id,
        testimonialId: item.testimonialId,
      });
    }
    await t.run(async (ctx) => {
      for (const report of await ctx.db.query("spamQuarantines").collect()) {
        await ctx.db.patch(report._id, {
          reportedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        });
      }
    });
    const next = await createPendingTestimonial(
      t,
      "acme-proof",
      "new-window-spam",
    );
    await expect(
      owner.client.mutation(api.testimonialModeration.markSpam, {
        organizationId: brand.id,
        testimonialId: next.testimonialId,
      }),
    ).resolves.toMatchObject({ creditRestored: true });
  });

  it("keeps collection closed when Spam undo races use of the restored credit", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const testimonials = await Promise.all(
      Array.from({ length: 13 }, (_, index) =>
        createPendingTestimonial(t, "acme-proof", `undo-race-${index}`),
      ),
    );
    await owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: brand.id,
      testimonialId: testimonials[0]!.testimonialId,
    });

    const [newCollection, undo] = await Promise.allSettled([
      createPendingTestimonial(t, "acme-proof", "undo-race-new-credit"),
      owner.client.mutation(api.testimonialModeration.undoSpam, {
        organizationId: brand.id,
        testimonialId: testimonials[0]!.testimonialId,
      }),
    ]);
    expect(undo.status).toBe("fulfilled");
    expect(["fulfilled", "rejected"]).toContain(newCollection.status);
    const activeCredits = await t.run(async (ctx) => {
      const credits = await ctx.db
        .query("collectionCredits")
        .withIndex("by_organization_type", (index) =>
          index.eq("organizationId", brand.id).eq("submissionType", "text"),
        )
        .collect();
      return credits.filter((credit) => credit.restoredAt === undefined).length;
    });
    expect(activeCredits).toBeGreaterThanOrEqual(13);
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ textAvailable: false });
  });

  it("removes quarantined Spam from public surfaces and restores it with a safe fresh order key", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const created = await createPendingTestimonial(
      t,
      "acme-proof",
      "published-spam-submission",
    );
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: created.testimonialId,
    });
    const originalProjection = await t.run((ctx) =>
      ctx.db.query("publicTestimonialProjections").unique(),
    );

    await owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });
    await owner.client.mutation(api.testimonialModeration.undoSpam, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });

    await expect(
      t.run((ctx) => ctx.db.query("publicTestimonialProjections").unique()),
    ).resolves.toMatchObject({ publishedAt: originalProjection!.publishedAt });
  });

  it("permanently removes expired Spam while preserving its restored lifetime credit", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const created = await createPendingTestimonial(
      t,
      "acme-proof",
      "expired-spam-submission",
    );
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: created.testimonialId,
    });
    await owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: brand.id,
      testimonialId: created.testimonialId,
    });
    const quarantine = await t.run((ctx) =>
      ctx.db.query("spamQuarantines").unique(),
    );
    await t.run((ctx) =>
      ctx.db.patch(quarantine!._id, { expiresAt: Date.now() - 1 }),
    );

    await t.mutation(internal.testimonialModeration.expireSpamQuarantine, {
      quarantineId: quarantine!._id,
    });
    await expect(
      t.mutation(internal.testimonialModeration.expireSpamQuarantine, {
        quarantineId: quarantine!._id,
      }),
    ).resolves.toEqual({ expired: false });

    const stored = await t.run(async (ctx) => ({
      credit: await ctx.db.query("collectionCredits").unique(),
      audits: await ctx.db.query("auditEvents").collect(),
      quarantine: await ctx.db.get(quarantine!._id),
      testimonial: await ctx.db.get(created.testimonialId),
    }));
    expect(stored.testimonial).toBeNull();
    expect(stored.credit?.restoredAt).toBeGreaterThan(0);
    expect(stored.quarantine?.status).toBe("expired");
    expect(stored.audits.map((event) => event.targetLabel)).not.toContain(
      "Camille Test",
    );
    expect(stored.audits).toContainEqual(
      expect.objectContaining({
        eventType: "testimonial.spam_expired",
        targetLabel: "Expired Spam",
      }),
    );
  });

  it("deletes video application media when Spam quarantine expires", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "spam-video-submission",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: { avatarSupplied: false, name: "Camille Test" },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "spam-video-submission",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 30,
      reservationId: upload.reservationId,
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
    });
    await owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: brand.id,
      testimonialId: submitted.testimonialId,
    });
    const quarantine = await t.run((ctx) =>
      ctx.db.query("spamQuarantines").unique(),
    );
    await t.run((ctx) =>
      ctx.db.patch(quarantine!._id, { expiresAt: Date.now() - 1 }),
    );

    await t.mutation(internal.testimonialModeration.expireSpamQuarantine, {
      quarantineId: quarantine!._id,
    });

    await expect(
      t.run(async (ctx) => ({
        assets: await ctx.db.query("videoAssets").collect(),
        reservations: await ctx.db.query("videoReservations").collect(),
        testimonials: await ctx.db.query("testimonials").collect(),
      })),
    ).resolves.toEqual({ assets: [], reservations: [], testimonials: [] });
  });

  it("keeps the Free credit restored when Ready and Spam race", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "ready-spam-race",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    vi.stubEnv("MUX_PROVIDER", "mux");
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: { avatarSupplied: false, name: "Camille Test" },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "ready-spam-race",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 30,
      reservationId: upload.reservationId,
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
    });
    vi.stubEnv("MUX_PROVIDER", "fake");

    await Promise.allSettled([
      t.mutation(internal.video.completeFakeAsset, {
        testimonialId: submitted.testimonialId,
      }),
      owner.client.mutation(api.testimonialModeration.markSpam, {
        organizationId: brand.id,
        testimonialId: submitted.testimonialId,
      }),
    ]);

    const state = await t.run(async (ctx) => ({
      credit: await ctx.db.query("collectionCredits").unique(),
      quarantine: await ctx.db.query("spamQuarantines").unique(),
      testimonial: await ctx.db.get(submitted.testimonialId),
    }));
    expect(state.testimonial?.moderationStatus).toBe("spam");
    expect(state.quarantine).toMatchObject({
      creditRestored: true,
      restorationMode: "automatic",
      status: "active",
    });
    expect(state.credit).toMatchObject({ restorationMode: "automatic" });
    expect(state.credit?.restoredAt).toBeGreaterThan(0);
  });

  it("serializes video deletion and Spam without leaving both workflows active", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "delete-spam-race",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en",
    });
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: { avatarSupplied: false, name: "Camille Test" },
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "delete-spam-race",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 30,
      reservationId: upload.reservationId,
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
    });

    await Promise.allSettled([
      owner.client.mutation(internal.videoMedia.prepareRemoval, {
        organizationId: brand.id,
        testimonialId: submitted.testimonialId,
      }),
      owner.client.mutation(api.testimonialModeration.markSpam, {
        organizationId: brand.id,
        testimonialId: submitted.testimonialId,
      }),
    ]);
    const state = await t.run(async (ctx) => ({
      deletion: await ctx.db.query("videoMediaDeletions").unique(),
      quarantine: await ctx.db.query("spamQuarantines").unique(),
      testimonial: await ctx.db.get(submitted.testimonialId),
    }));
    expect(Boolean(state.deletion) && Boolean(state.quarantine)).toBe(false);
    expect(
      state.deletion !== null ||
        (state.quarantine?.status === "active" &&
          state.testimonial?.moderationStatus === "spam"),
    ).toBe(true);
  });

  it("returns null for an unknown wall without leaking Brand existence details", async () => {
    const t = createConvexTest();
    await expect(
      t.query(api.publicWall.getBrand, { publicSlug: "missing-brand" }),
    ).resolves.toBeNull();
  });
});
