import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  buildPublicationConsent,
  hashSubmissionManagementToken,
} from "@convex/domain/submission";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

const consent = buildPublicationConsent({
  brandName: "Acme Studio",
  privacyContact: "alice@example.com",
  suppliedIdentity: {
    avatarSupplied: false,
    company: "North Star Co",
    name: "Alice Martin",
    rating: 5,
    role: "Founder",
  },
});

const validSubmission = {
  ageConfirmed: true,
  clientSubmissionId: "client-submission-001",
  company: "North Star Co",
  consentAccepted: true,
  consentText: consent.text,
  consentVersion: consent.version,
  publicSlug: "acme-proof",
  rating: 5,
  role: "Founder",
  submitterEmail: "ALICE@Example.com",
  submitterName: "Alice Martin",
  text: "Get Some Proof made our customer stories much easier to share.",
};

describe("text Submission collection", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("atomically creates one Pending Testimonial and exact versioned Publication Consent", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    const result = await t.action(api.submissions.submitText, validSubmission);

    expect(result).toEqual({
      moderationStatus: "pending",
      testimonialId: expect.any(String),
    });
    expect(result).not.toHaveProperty("submitterEmail");
    expect(result).not.toHaveProperty("managementToken");

    const stored = await t.run(async (ctx) => ({
      consents: await ctx.db.query("publicationConsents").collect(),
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(stored.testimonials).toHaveLength(1);
    expect(stored.testimonials[0]).toMatchObject({
      clientSubmissionId: "client-submission-001",
      moderationStatus: "pending",
      organizationId: brand.id,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
      submissionType: "text",
      text: validSubmission.text,
    });
    expect(stored.consents).toHaveLength(1);
    expect(stored.consents[0]).toMatchObject({
      brandName: "Acme Studio",
      consentText: expect.stringContaining("Acme Studio"),
      consentVersion: "2026-09-03.v1",
      identityFields: ["name", "role", "company", "rating"],
      organizationId: brand.id,
      testimonialId: stored.testimonials[0]._id,
    });
    expect(stored.deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientKind: "submitter",
          status: "sent",
          testimonialId: stored.testimonials[0]._id,
        }),
        expect.objectContaining({
          recipientKind: "owner",
          status: "sent",
          testimonialId: stored.testimonials[0]._id,
        }),
      ]),
    );
  });

  it("treats replay as the same successful Submission without duplicate records or emails", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    const first = await t.action(api.submissions.submitText, validSubmission);
    const replay = await t.action(api.submissions.submitText, validSubmission);

    expect(replay).toEqual(first);
    const counts = await t.run(async (ctx) => ({
      consents: (await ctx.db.query("publicationConsents").collect()).length,
      deliveries: (await ctx.db.query("submissionEmailDeliveries").collect())
        .length,
      testimonials: (await ctx.db.query("testimonials").collect()).length,
    }));
    expect(counts).toEqual({ consents: 1, deliveries: 2, testimonials: 1 });
  });

  it.each([
    ["invalid slug", { publicSlug: "missing-brand" }],
    ["short text", { text: "Too short" }],
    ["missing age confirmation", { ageConfirmed: false }],
    ["missing consent", { consentAccepted: false }],
  ])(
    "rejects %s without retaining a partial Submission",
    async (_label, patch) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });

      await expect(
        t.action(api.submissions.submitText, {
          ...validSubmission,
          clientSubmissionId: `invalid-${String(Object.values(patch)[0])}`,
          ...patch,
        }),
      ).rejects.toBeDefined();
      await expect(
        t.run(async (ctx) => await ctx.db.query("testimonials").collect()),
      ).resolves.toEqual([]);
    },
  );

  it("keeps a valid Submission when both transactional emails fail", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    await expect(
      t.action(api.submissions.submitText, validSubmission),
    ).resolves.toMatchObject({ moderationStatus: "pending" });
    const stored = await t.run(async (ctx) => ({
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(stored.testimonials).toHaveLength(1);
    expect(stored.deliveries).toHaveLength(2);
    expect(stored.deliveries.every(({ status }) => status === "failed")).toBe(
      true,
    );
  });

  it("retries failed delivery on replay without duplicating the Submission", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    const first = await t.action(api.submissions.submitText, validSubmission);
    const before = await t.run(async (ctx) => ({
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      testimonial: (await ctx.db.query("testimonials").collect())[0],
    }));
    vi.stubEnv("EMAIL_PROVIDER", "test");
    const replay = await t.action(api.submissions.submitText, validSubmission);
    const after = await t.run(async (ctx) => ({
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));

    expect(replay).toEqual(first);
    expect(after.testimonials).toHaveLength(1);
    expect(after.deliveries).toHaveLength(2);
    expect(after.deliveries.every(({ status }) => status === "sent")).toBe(
      true,
    );
    expect(after.testimonials[0].managementTokenHash).not.toBe(
      before.testimonial.managementTokenHash,
    );
  });

  it("resolves the private Submission only from its hashed management token", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const token = "a".repeat(64);
    await t.mutation(internal.submissions.createTextRecords, {
      ...validSubmission,
      deliveryAttemptId: "delivery-attempt-management-link",
      managementTokenHash: await hashSubmissionManagementToken(token),
    });

    await expect(
      t.query(api.submissions.getByManagementToken, { token }),
    ).resolves.toMatchObject({
      brandName: "Acme Studio",
      submitterEmail: "alice@example.com",
      text: validSubmission.text,
    });
    await expect(
      t.query(api.submissions.getByManagementToken, {
        token: "b".repeat(64),
      }),
    ).resolves.toBeNull();
  });

  it("binds an optional avatar upload to one Submission and consumes its reservation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.mutation(api.submissions.generateAvatarUploadUrl, {
      clientSubmissionId: validSubmission.clientSubmissionId,
      publicSlug: validSubmission.publicSlug,
    });
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["avatar"]));
      await ctx.db.patch(id, { contentType: "image/jpeg" });
      return id;
    });
    await t.mutation(api.submissions.registerAvatarUpload, {
      reservationId: upload.reservationId,
      storageId,
    });

    await t.action(api.submissions.submitText, {
      ...validSubmission,
      avatarReservationId: upload.reservationId,
      avatarStorageId: storageId,
      consentText: buildPublicationConsent({
        brandName: "Acme Studio",
        privacyContact: "alice@example.com",
        suppliedIdentity: {
          avatarSupplied: true,
          company: validSubmission.company,
          name: validSubmission.submitterName,
          rating: validSubmission.rating,
          role: validSubmission.role,
        },
      }).text,
    });

    await expect(
      t.run((ctx) => ctx.db.get(upload.reservationId)),
    ).resolves.toBeNull();
    await expect(
      t.run((ctx) => ctx.db.query("testimonials").unique()),
    ).resolves.toMatchObject({ avatarStorageId: storageId });
  });

  it("bounds avatar upload attempts for one browser Submission", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    await t.mutation(api.submissions.generateAvatarUploadUrl, {
      clientSubmissionId: validSubmission.clientSubmissionId,
      publicSlug: validSubmission.publicSlug,
    });
    await t.mutation(api.submissions.generateAvatarUploadUrl, {
      clientSubmissionId: validSubmission.clientSubmissionId,
      publicSlug: validSubmission.publicSlug,
    });
    await t.mutation(api.submissions.generateAvatarUploadUrl, {
      clientSubmissionId: validSubmission.clientSubmissionId,
      publicSlug: validSubmission.publicSlug,
    });
    await expect(
      t.mutation(api.submissions.generateAvatarUploadUrl, {
        clientSubmissionId: validSubmission.clientSubmissionId,
        publicSlug: validSubmission.publicSlug,
      }),
    ).rejects.toMatchObject({
      data: { code: "AVATAR_UPLOAD_LIMIT_REACHED" },
    });
  });

  it("cleans up an uploaded avatar even when registration never reaches the server", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const upload = await t.mutation(api.submissions.generateAvatarUploadUrl, {
        clientSubmissionId: validSubmission.clientSubmissionId,
        publicSlug: validSubmission.publicSlug,
      });
      const orphanStorageId = await t.run(async (ctx) =>
        ctx.storage.store(new Blob(["orphan avatar"])),
      );

      vi.setSystemTime(new Date(startedAt.getTime() + 3 * 60 * 60 * 1_000 + 1));
      await t.mutation(internal.submissions.expireAvatarUpload, {
        reservationId: upload.reservationId,
      });
      const cleanupJob = await t.run((ctx) =>
        ctx.db.query("storageCleanupJobs").unique(),
      );
      if (!cleanupJob) throw new Error("Storage cleanup job missing.");
      await t.mutation(internal.submissions.cleanupUnreferencedAvatarStorage, {
        attemptId: cleanupJob.attemptId,
        cleanupJobId: cleanupJob._id,
      });

      await expect(
        t.run((ctx) => ctx.db.system.get("_storage", orphanStorageId)),
      ).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces concurrent avatar expirations into one storage sweep", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const [first, second] = await Promise.all([
        t.mutation(api.submissions.generateAvatarUploadUrl, {
          clientSubmissionId: "avatar-submission-one",
          publicSlug: "acme-proof",
        }),
        t.mutation(api.submissions.generateAvatarUploadUrl, {
          clientSubmissionId: "avatar-submission-two",
          publicSlug: "acme-proof",
        }),
      ]);
      vi.setSystemTime(new Date(startedAt.getTime() + 3 * 60 * 60 * 1_000 + 1));

      await Promise.all([
        t.mutation(internal.submissions.expireAvatarUpload, {
          reservationId: first.reservationId,
        }),
        t.mutation(internal.submissions.expireAvatarUpload, {
          reservationId: second.reservationId,
        }),
      ]);

      await expect(
        t.run((ctx) => ctx.db.query("storageCleanupJobs").collect()),
      ).resolves.toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fences a stale storage sweep after its singleton lease is reacquired", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const first = await t.mutation(api.submissions.generateAvatarUploadUrl, {
        clientSubmissionId: "avatar-stale-sweep-one",
        publicSlug: "acme-proof",
      });
      const second = await t.mutation(api.submissions.generateAvatarUploadUrl, {
        clientSubmissionId: "avatar-stale-sweep-two",
        publicSlug: "acme-proof",
      });
      vi.setSystemTime(new Date(startedAt.getTime() + 3 * 60 * 60 * 1_000 + 1));
      await t.mutation(internal.submissions.expireAvatarUpload, {
        reservationId: first.reservationId,
      });
      const firstJob = await t.run((ctx) =>
        ctx.db.query("storageCleanupJobs").unique(),
      );
      if (!firstJob) throw new Error("First cleanup job missing.");

      vi.setSystemTime(new Date(startedAt.getTime() + 4 * 60 * 60 * 1_000 + 2));
      await t.mutation(internal.submissions.expireAvatarUpload, {
        reservationId: second.reservationId,
      });
      const reacquiredJob = await t.run((ctx) =>
        ctx.db.query("storageCleanupJobs").unique(),
      );
      if (!reacquiredJob) throw new Error("Reacquired cleanup job missing.");
      expect(reacquiredJob.attemptId).not.toBe(firstJob.attemptId);

      await t.mutation(internal.submissions.cleanupUnreferencedAvatarStorage, {
        attemptId: firstJob.attemptId,
        cleanupJobId: firstJob._id,
      });
      await expect(
        t.run((ctx) => ctx.db.get(reacquiredJob._id)),
      ).resolves.toMatchObject({ attemptId: reacquiredJob.attemptId });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps concurrent replays to one delivery attempt and one management token", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    const [first, second] = await Promise.all([
      t.action(api.submissions.submitText, validSubmission),
      t.action(api.submissions.submitText, validSubmission),
    ]);
    const stored = await t.run(async (ctx) => ({
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));

    expect(second).toEqual(first);
    expect(stored.testimonials).toHaveLength(1);
    expect(stored.deliveries).toHaveLength(2);
    expect(
      new Set(stored.deliveries.map(({ attemptId }) => attemptId)).size,
    ).toBe(1);
    expect(stored.deliveries.every(({ status }) => status === "sent")).toBe(
      true,
    );
  });

  it("does not retry or rotate a Pending email with an ambiguous provider outcome", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-03T12:00:00.000Z");
      vi.setSystemTime(startedAt);
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      await owner.client.mutation(api.organizations.create, {
        name: "Acme Studio",
        publicSlug: "acme-proof",
      });
      const firstTokenHash = await hashSubmissionManagementToken(
        "first-management-token",
      );
      const first = await t.mutation(internal.submissions.createTextRecords, {
        ...validSubmission,
        deliveryAttemptId: "first-delivery-attempt",
        managementTokenHash: firstTokenHash,
      });
      vi.setSystemTime(new Date(startedAt.getTime() + 10 * 60 * 1_000));
      const replay = await t.mutation(internal.submissions.createTextRecords, {
        ...validSubmission,
        deliveryAttemptId: "second-delivery-attempt",
        managementTokenHash: await hashSubmissionManagementToken(
          "second-management-token",
        ),
      });
      const testimonial = await t.run((ctx) => ctx.db.get(first.testimonialId));

      expect(replay.shouldDeliver).toBe(false);
      expect(replay.deliveries).toEqual([]);
      expect(testimonial?.managementTokenHash).toBe(firstTokenHash);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a consent snapshot that no longer matches the Brand", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });

    await expect(
      t.action(api.submissions.submitText, {
        ...validSubmission,
        consentText: `${validSubmission.consentText} changed`,
      }),
    ).rejects.toMatchObject({ data: { code: "CONSENT_CHANGED" } });
    await expect(
      t.run(async (ctx) => ctx.db.query("testimonials").collect()),
    ).resolves.toEqual([]);
  });

  it("notifies the active current Owner instead of the Brand creator", async () => {
    const t = createConvexTest();
    const creator = await authenticatedUser(t);
    const brand = await creator.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const currentOwner = await authenticatedUser(t, {
      email: "owner@example.com",
      name: "Current Owner",
    });
    await addMemberWithRole(
      t,
      brand.id,
      currentOwner.actorId,
      "owner",
      "active",
      { displayName: "Current Owner", email: "owner@example.com" },
    );
    await t.run(async (ctx) => {
      const creatorMembership = await ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index.eq("organizationId", brand.id).eq("userId", creator.actorId),
        )
        .unique();
      if (!creatorMembership) throw new Error("Creator membership missing.");
      await ctx.db.patch(creatorMembership._id, { status: "inactive" });
    });

    await t.action(api.submissions.submitText, validSubmission);
    const ownerDelivery = await t.run(async (ctx) =>
      ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", brand.id),
        )
        .filter((queryFilter) =>
          queryFilter.eq(queryFilter.field("recipientKind"), "owner"),
        )
        .unique(),
    );
    expect(ownerDelivery?.recipientEmail).toBe("owner@example.com");
  });

  it("denies cross-tenant Owner reads", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const aliceBrand = await alice.client.mutation(api.organizations.create, {
      name: "Alice Brand",
      publicSlug: "acme-proof",
    });
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Owner",
    });
    const bobBrand = await bob.client.mutation(api.organizations.create, {
      name: "Bob Brand",
      publicSlug: "bob-proof",
    });
    const created = await t.action(api.submissions.submitText, {
      ...validSubmission,
      consentText: buildPublicationConsent({
        brandName: "Alice Brand",
        privacyContact: "alice@example.com",
        suppliedIdentity: {
          avatarSupplied: false,
          company: validSubmission.company,
          name: validSubmission.submitterName,
          rating: validSubmission.rating,
          role: validSubmission.role,
        },
      }).text,
    });

    await expect(
      alice.client.query(api.submissions.getPrivate, {
        organizationId: aliceBrand.id,
        testimonialId: created.testimonialId,
      }),
    ).resolves.toMatchObject({ submitterEmail: "alice@example.com" });
    await expect(
      bob.client.query(api.submissions.getPrivate, {
        organizationId: bobBrand.id,
        testimonialId: created.testimonialId,
      }),
    ).rejects.toMatchObject({
      data: { code: "TESTIMONIAL_UNAVAILABLE" },
    });
  });

  it("denies private Submission reads to a same-Workspace Viewer", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const viewer = await authenticatedUser(t, {
      email: "viewer@example.com",
      name: "Vic Viewer",
    });
    await addMemberWithRole(t, brand.id, viewer.actorId, "viewer");
    const created = await t.action(api.submissions.submitText, validSubmission);

    await expect(
      viewer.client.query(api.submissions.getPrivate, {
        organizationId: brand.id,
        testimonialId: created.testimonialId,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
  });
});
