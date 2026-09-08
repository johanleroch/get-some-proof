import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

/** The Public Wall reads only through the server, which proves itself with this. */
const publicWallSecret = "wall-service-test-credential-32-characters";

/**
 * The Inbox's Published category is the Public Wall: whatever order and
 * whatever per-card details a visitor sees, the Owner sees the same in the
 * Inbox. These tests pin the two queries together across a move, a Spam
 * report, and a Visibility Override.
 */
describe("Inbox Published order and the Public Wall", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_READ_RATE_LIMIT_SECRET", publicWallSecret);
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

  async function setup() {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    return { brand, owner, t };
  }

  async function createPending(
    current: Awaited<ReturnType<typeof setup>>,
    suffix: string,
  ) {
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: {
        avatarSupplied: false,
        company: "North Star",
        name: `Submitter ${suffix}`,
        rating: 5,
        role: "Founder",
      },
    });
    const created = await current.t.mutation(
      internal.submissions.createTextRecords,
      {
        ageConfirmed: true,
        clientSubmissionId: `inbox-${suffix}`,
        company: "North Star",
        consentAccepted: true,
        consentText: consent.text,
        consentVersion: consent.version,
        deliveryAttemptId: `delivery-${suffix}`,
        managementTokenHash: suffix.padEnd(64, "e").slice(0, 64),
        publicSlug: "acme-proof",
        rating: 5,
        role: "Founder",
        submitterEmail: `${suffix}@example.invalid`,
        submitterName: `Submitter ${suffix}`,
        text: `A useful public testimonial for the ${suffix} order case.`,
      },
    );
    return created.testimonialId;
  }

  async function createAndPublish(
    current: Awaited<ReturnType<typeof setup>>,
    suffix: string,
  ) {
    const testimonialId = await createPending(current, suffix);
    await current.owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: current.brand.id,
      status: "published",
      testimonialId,
    });
    return testimonialId;
  }

  /** Every Published name in Inbox order, following continue cursors. */
  async function inboxWallNames(
    current: Awaited<ReturnType<typeof setup>>,
    numItems: number,
  ) {
    const names: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await current.owner.client.query(
        api.testimonialModeration.listInbox,
        {
          organizationId: current.brand.id,
          paginationOpts: { cursor, numItems },
          sort: "wall",
          status: "published",
        },
      );
      names.push(...page.page.map(({ submitterName }) => submitterName));
      if (page.isDone) return names;
      cursor = page.continueCursor;
    }
    throw new Error("Inbox pagination never reached isDone.");
  }

  /** Every name a visitor sees, following continue cursors. */
  async function publicWallNames(
    current: Awaited<ReturnType<typeof setup>>,
    numItems: number,
  ) {
    const names: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await current.t.query(api.publicWall.list, {
        paginationOpts: { cursor, numItems },
        publicSlug: "acme-proof",
        secret: publicWallSecret,
      });
      names.push(...page.page.map(({ name }) => name));
      if (page.isDone) return names;
      cursor = page.continueCursor;
    }
    throw new Error("Public Wall pagination never reached isDone.");
  }

  it("shows the Owner exactly the visitor's order, before and after a move", async () => {
    const current = await setup();
    const first = await createAndPublish(current, "first");
    await createAndPublish(current, "second");
    const third = await createAndPublish(current, "third");

    // Newest Published proof first, on both surfaces, page by page.
    const expectedBefore = [
      "Submitter third",
      "Submitter second",
      "Submitter first",
    ];
    await expect(inboxWallNames(current, 20)).resolves.toEqual(expectedBefore);
    await expect(publicWallNames(current, 20)).resolves.toEqual(expectedBefore);
    await expect(inboxWallNames(current, 1)).resolves.toEqual(expectedBefore);
    await expect(publicWallNames(current, 1)).resolves.toEqual(expectedBefore);

    // The Owner drags the oldest to the top: the Wall follows at once.
    await current.owner.client.mutation(api.wallCustomization.movePublished, {
      afterTestimonialId: third,
      organizationId: current.brand.id,
      testimonialId: first,
    });
    const expectedAfter = [
      "Submitter first",
      "Submitter third",
      "Submitter second",
    ];
    await expect(inboxWallNames(current, 20)).resolves.toEqual(expectedAfter);
    await expect(publicWallNames(current, 20)).resolves.toEqual(expectedAfter);
    await expect(inboxWallNames(current, 2)).resolves.toEqual(expectedAfter);
    await expect(publicWallNames(current, 2)).resolves.toEqual(expectedAfter);

    // Then to the very end, between nothing and the last card.
    const listed = await current.owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: current.brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "wall",
        status: "published",
      },
    );
    const last = listed.page[listed.page.length - 1]!;
    await current.owner.client.mutation(api.wallCustomization.movePublished, {
      beforeTestimonialId: last.testimonialId,
      organizationId: current.brand.id,
      testimonialId: first,
    });
    const expectedEnd = [
      "Submitter third",
      "Submitter second",
      "Submitter first",
    ];
    await expect(inboxWallNames(current, 20)).resolves.toEqual(expectedEnd);
    await expect(publicWallNames(current, 20)).resolves.toEqual(expectedEnd);
  });

  it("keeps a Spam Testimonial in one count only and off both Wall lists", async () => {
    const current = await setup();
    await createAndPublish(current, "kept");
    const reported = await createAndPublish(current, "reported");
    await createPending(current, "waiting");

    await expect(
      current.owner.client.query(api.testimonialModeration.countInbox, {
        organizationId: current.brand.id,
      }),
    ).resolves.toEqual({ archived: 0, pending: 1, published: 2, spam: 0 });

    await current.owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: current.brand.id,
      testimonialId: reported,
    });

    await expect(
      current.owner.client.query(api.testimonialModeration.countInbox, {
        organizationId: current.brand.id,
      }),
    ).resolves.toEqual({ archived: 0, pending: 1, published: 1, spam: 1 });
    await expect(inboxWallNames(current, 20)).resolves.toEqual([
      "Submitter kept",
    ]);
    await expect(publicWallNames(current, 20)).resolves.toEqual([
      "Submitter kept",
    ]);
    const spamPage = await current.owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: current.brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        status: "spam",
      },
    );
    expect(spamPage.page.map(({ testimonialId }) => testimonialId)).toEqual([
      reported,
    ]);
    expect(spamPage.page[0]).toMatchObject({
      moderationStatus: "spam",
      quarantineExpiresAt: expect.any(Number),
    });
  });

  it("rejects the Wall order for any category but Published", async () => {
    const current = await setup();
    for (const status of ["pending", "archived", "spam", undefined] as const) {
      await expect(
        current.owner.client.query(api.testimonialModeration.listInbox, {
          organizationId: current.brand.id,
          paginationOpts: { cursor: null, numItems: 20 },
          sort: "wall",
          ...(status ? { status } : {}),
        }),
      ).rejects.toMatchObject({ data: { code: "INVALID_INBOX_SORT" } });
    }
  });

  it("carries each Visibility Override into the Inbox item and onto the Wall", async () => {
    const current = await setup();
    const testimonialId = await createAndPublish(current, "details");
    const pendingId = await createPending(current, "not-yet");

    // The dialog sends only the details the Owner chose, never undefined.
    await current.owner.client.mutation(
      api.wallCustomization.setTestimonialVisibility,
      {
        organizationId: current.brand.id,
        overrides: { company: false, role: true },
        testimonialId,
      },
    );
    const page = await current.owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: current.brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "wall",
        status: "published",
      },
    );
    expect(page.page[0]).toMatchObject({
      publicVisibilityOverrides: { company: false, role: true },
      testimonialId,
    });
    const wall = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
      secret: publicWallSecret,
    });
    expect(wall.page[0]).toMatchObject({ role: "Founder" });
    expect(wall.page[0]).not.toHaveProperty("company");

    // Clearing every choice back to "Wall default" is an empty object.
    await current.owner.client.mutation(
      api.wallCustomization.setTestimonialVisibility,
      {
        organizationId: current.brand.id,
        overrides: {},
        testimonialId,
      },
    );
    const cleared = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      secret: publicWallSecret,
      publicSlug: "acme-proof",
    });
    expect(cleared.page[0]).toMatchObject({
      company: "North Star",
      role: "Founder",
    });

    // A Pending Testimonial has no Wall card to customize.
    await expect(
      current.owner.client.mutation(
        api.wallCustomization.setTestimonialVisibility,
        {
          organizationId: current.brand.id,
          overrides: { company: false },
          testimonialId: pendingId,
        },
      ),
    ).rejects.toMatchObject({
      data: {
        code: "INVALID_WALL_CUSTOMIZATION",
        message: "Only a Published Testimonial can customize public fields.",
      },
    });
  });
});
