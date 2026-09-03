import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import { legacyPublicOrderKey } from "@convex/migrations";
import { publicOrderKeyBetween } from "@convex/publicProjection";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Public Wall customization and curation", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_wall");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_wall");
  });

  async function setup() {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      primaryColor: "#123abc",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    return { brand, owner, t };
  }

  async function createAndPublish(
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
        clientSubmissionId: `wall-${suffix}`,
        company: "North Star",
        consentAccepted: true,
        consentText: consent.text,
        consentVersion: consent.version,
        deliveryAttemptId: `delivery-${suffix}`,
        managementTokenHash: suffix.padEnd(64, "d").slice(0, 64),
        publicSlug: "acme-proof",
        rating: 5,
        role: "Founder",
        submitterEmail: `${suffix}@example.invalid`,
        submitterName: `Submitter ${suffix}`,
        text: `A useful public testimonial for the ${suffix} curation case.`,
      },
    );
    await current.owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: current.brand.id,
      status: "published",
      testimonialId: created.testimonialId,
    });
    return created.testimonialId;
  }

  it("puts newly Published proof first and moves one item atomically", async () => {
    const current = await setup();
    const first = await createAndPublish(current, "first");
    const second = await createAndPublish(current, "second");
    const third = await createAndPublish(current, "third");
    await expect(
      current.owner.client.query(api.wallCustomization.listPublished, {
        organizationId: current.brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    ).resolves.toMatchObject({
      page: [
        { testimonialId: third },
        { testimonialId: second },
        { testimonialId: first },
      ],
    });

    await current.owner.client.mutation(api.wallCustomization.movePublished, {
      afterTestimonialId: third,
      organizationId: current.brand.id,
      testimonialId: first,
    });
    const publicPage = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    expect(publicPage.page.map(({ name }) => name)).toEqual([
      "Submitter first",
      "Submitter third",
      "Submitter second",
    ]);

    await expect(
      current.owner.client.mutation(api.wallCustomization.movePublished, {
        beforeTestimonialId: first,
        organizationId: current.brand.id,
        testimonialId: first,
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_WALL_CUSTOMIZATION" },
    });
    await expect(
      current.owner.client.query(api.wallCustomization.listPublished, {
        organizationId: current.brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    ).resolves.toMatchObject({
      page: [
        { testimonialId: first },
        { testimonialId: third },
        { testimonialId: second },
      ],
    });
  });

  it("rejects a stale concurrent gap after another move wins", async () => {
    const current = await setup();
    const first = await createAndPublish(current, "race-first");
    const second = await createAndPublish(current, "race-second");
    const third = await createAndPublish(current, "race-third");
    const fourth = await createAndPublish(current, "race-fourth");

    await current.owner.client.mutation(api.wallCustomization.movePublished, {
      afterTestimonialId: second,
      beforeTestimonialId: third,
      organizationId: current.brand.id,
      testimonialId: first,
    });
    await expect(
      current.owner.client.mutation(api.wallCustomization.movePublished, {
        afterTestimonialId: second,
        beforeTestimonialId: third,
        organizationId: current.brand.id,
        testimonialId: fourth,
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_WALL_CUSTOMIZATION" },
    });
  });

  it("keeps generating dense order keys under repeated prepends and moves", () => {
    let first = publicOrderKeyBetween();
    for (let index = 0; index < 1_000; index += 1) {
      const next = publicOrderKeyBetween(undefined, first);
      expect(next > first).toBe(true);
      first = next;
    }

    const lower = publicOrderKeyBetween();
    let upper = publicOrderKeyBetween(undefined, lower);
    for (let index = 0; index < 1_000; index += 1) {
      const between = publicOrderKeyBetween(upper, lower);
      expect(between > lower && between < upper).toBe(true);
      upper = between;
    }
  });

  it("backfills legacy projections in resumable batches", async () => {
    const current = await setup();
    await createAndPublish(current, "legacy-first");
    await createAndPublish(current, "legacy-second");
    await current.t.run(async (ctx) => {
      const projections = await ctx.db
        .query("publicTestimonialProjections")
        .collect();
      for (const projection of projections) {
        await ctx.db.patch(projection._id, { publicOrderKey: undefined });
      }
    });

    const firstBatch = await current.t.mutation(
      internal.migrations.backfillPublicOrderKeys,
      { batchSize: 1, cursor: null },
    );
    expect(firstBatch).toMatchObject({ isDone: false, updated: 1 });
    await createAndPublish(current, "live-during-migration");
    const secondBatch = await current.t.mutation(
      internal.migrations.backfillPublicOrderKeys,
      { batchSize: 2, cursor: firstBatch.continueCursor },
    );
    expect(secondBatch).toMatchObject({ isDone: true, updated: 1 });

    const projections = await current.t.run((ctx) =>
      ctx.db.query("publicTestimonialProjections").collect(),
    );
    expect(projections.every(({ publicOrderKey }) => publicOrderKey)).toBe(
      true,
    );
    const publicPage = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    expect(publicPage.page.map(({ name }) => name)).toEqual([
      "Submitter live-during-migration",
      "Submitter legacy-second",
      "Submitter legacy-first",
    ]);
  });

  it("derives unique legacy keys ordered by publication time", () => {
    const older = legacyPublicOrderKey({
      _creationTime: 10,
      _id: "projection-a" as never,
      publishedAt: 100,
    });
    const newer = legacyPublicOrderKey({
      _creationTime: 20,
      _id: "projection-b" as never,
      publishedAt: 200,
    });
    const tie = legacyPublicOrderKey({
      _creationTime: 21,
      _id: "projection-c" as never,
      publishedAt: 200,
    });
    expect(older < newer && newer < tie).toBe(true);
    expect([older, newer, tie]).toHaveLength(new Set([older, newer, tie]).size);
    expect(tie < publicOrderKeyBetween()).toBe(true);
  });

  it("resolves global and per-Testimonial visibility without ever hiding name", async () => {
    const current = await setup();
    const testimonialId = await createAndPublish(current, "visibility");
    await current.owner.client.mutation(api.wallCustomization.updateSettings, {
      accentColor: "#f97316",
      hideAttribution: false,
      organizationId: current.brand.id,
      theme: "dark",
      transparentEmbed: true,
      visibility: {
        avatar: false,
        company: false,
        rating: false,
        role: false,
      },
    });
    let projection = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    expect(projection.page[0]).toMatchObject({
      avatarVisible: false,
      name: "Submitter visibility",
    });
    expect(projection.page[0]).not.toHaveProperty("company");
    expect(projection.page[0]).not.toHaveProperty("rating");
    expect(projection.page[0]).not.toHaveProperty("role");

    await current.owner.client.mutation(
      api.wallCustomization.setTestimonialVisibility,
      {
        organizationId: current.brand.id,
        overrides: { rating: true, role: true },
        testimonialId,
      },
    );
    projection = await current.t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "acme-proof",
    });
    expect(projection.page[0]).toMatchObject({
      name: "Submitter visibility",
      rating: 5,
      role: "Founder",
    });
    expect(projection.page[0]).not.toHaveProperty("company");
  });

  it("lets only the server-side Pro entitlement remove attribution", async () => {
    const current = await setup();
    await expect(
      current.owner.client.mutation(api.wallCustomization.updateSettings, {
        accentColor: "#123abc",
        hideAttribution: true,
        organizationId: current.brand.id,
        theme: "system",
        transparentEmbed: false,
        visibility: {
          avatar: true,
          company: true,
          rating: true,
          role: true,
        },
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_WALL_CUSTOMIZATION" },
    });
    await addStripeSubscription(current.t, String(current.brand.id), "active");
    await current.owner.client.mutation(api.wallCustomization.updateSettings, {
      accentColor: "#123abc",
      hideAttribution: true,
      organizationId: current.brand.id,
      theme: "system",
      transparentEmbed: false,
      visibility: {
        avatar: true,
        company: true,
        rating: true,
        role: true,
      },
    });
    await expect(
      current.t.query(api.publicWall.getBrand, { publicSlug: "acme-proof" }),
    ).resolves.toMatchObject({ attributionRequired: false });

    await current.t.mutation(
      components.stripe.private.handleSubscriptionUpdated,
      {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(Date.now() / 1_000),
        metadata: {
          lookupKey: "premium_monthly",
          orgId: String(current.brand.id),
        },
        status: "canceled",
        stripeSubscriptionId: `sub_${String(current.brand.id)}`,
      },
    );
    await expect(
      current.t.query(api.publicWall.getBrand, { publicSlug: "acme-proof" }),
    ).resolves.toMatchObject({ attributionRequired: true });
  });
});
