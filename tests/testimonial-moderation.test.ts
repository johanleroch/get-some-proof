import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import {
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
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
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
      testimonials: [
        {
          avatarUrl: null,
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
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ page: [] });
    const remaining = await t.run(async (ctx) => ({
      consents: await ctx.db.query("publicationConsents").collect(),
      deliveries: await ctx.db.query("submissionEmailDeliveries").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(remaining).toEqual({
      consents: [],
      deliveries: [],
      projections: [],
      testimonials: [],
    });
  });

  it("returns null for an unknown wall without leaking Brand existence details", async () => {
    const t = createConvexTest();
    await expect(
      t.query(api.publicWall.getBrand, { publicSlug: "missing-brand" }),
    ).resolves.toBeNull();
  });
});
