import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import {
  buildPublicationConsent,
  hashSubmissionManagementToken,
} from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

const managementToken = "c".repeat(64);

function consentFor(
  name: string,
  identity: { company?: string; rating?: number; role?: string } = {},
) {
  return buildPublicationConsent({
    brandName: "Proof Garden",
    privacyContact: "privacy@proof-garden.example",
    suppliedIdentity: {
      avatarSupplied: false,
      name,
      ...identity,
    },
  });
}

describe("complete local MVP happy paths", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MANAGEMENT_LINK_TOKEN_SECRET", "m".repeat(64));
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("collects, notifies, moderates, revises, republishes, and withdraws text across private and public boundaries", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, {
      email: "owner@proof-garden.example",
      name: "Proof Garden Owner",
    });
    const outsider = await authenticatedUser(t, {
      email: "outsider@example.invalid",
      name: "Outside Owner",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Proof Garden",
      privacyContact: "privacy@proof-garden.example",
      publicSlug: "proof-garden",
    });
    const otherBrand = await outsider.client.mutation(
      api.organizations.create,
      {
        name: "Outside Brand",
        publicSlug: "outside-brand",
      },
    );
    const initialConsent = consentFor("Camille Test", {
      company: "North Star Co",
      rating: 5,
      role: "Founder",
    });

    const submitted = await t.action(api.submissions.submitText, {
      ageConfirmed: true,
      clientSubmissionId: "mvp-text-happy-path",
      company: "North Star Co",
      consentAccepted: true,
      consentText: initialConsent.text,
      consentVersion: initialConsent.version,
      publicSlug: "proof-garden",
      rating: 5,
      role: "Founder",
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
      text: "Proof Garden made our customer stories clear and useful.",
    });

    await expect(
      owner.client.query(api.submissions.getPrivate, {
        organizationId: brand.id,
        testimonialId: submitted.testimonialId,
      }),
    ).resolves.toMatchObject({
      consentText: initialConsent.text,
      moderationStatus: "pending",
      submitterEmail: "camille@example.invalid",
    });
    await expect(
      outsider.client.query(api.submissions.getPrivate, {
        organizationId: otherBrand.id,
        testimonialId: submitted.testimonialId,
      }),
    ).rejects.toMatchObject({ data: { code: "TESTIMONIAL_UNAVAILABLE" } });
    const deliveries = await t.run((ctx) =>
      ctx.db.query("submissionEmailDeliveries").collect(),
    );
    expect(deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recipientKind: "owner", status: "sent" }),
        expect.objectContaining({
          recipientKind: "submitter",
          status: "sent",
        }),
      ]),
    );
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden",
      }),
    ).resolves.toMatchObject({ page: [] });

    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: submitted.testimonialId,
    });
    const published = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "proof-garden",
    });
    expect(published.page).toEqual([
      expect.objectContaining({
        name: "Camille Test",
        text: "Proof Garden made our customer stories clear and useful.",
        type: "text",
      }),
    ]);
    expect(JSON.stringify(published)).not.toMatch(
      /camille@example\.invalid|consentText|moderationStatus|organizationId/,
    );

    const managementTokenHash =
      await hashSubmissionManagementToken(managementToken);
    await t.run((ctx) =>
      ctx.db.patch(submitted.testimonialId, {
        managementTokenHash,
      }),
    );
    const revisedConsent = consentFor("Camille Test", {
      company: "North Star Labs",
      rating: 4,
      role: "CEO",
    });
    await t.mutation(api.submissionManagement.confirmRevision, {
      company: "North Star Labs",
      consentAccepted: true,
      consentText: revisedConsent.text,
      consentVersion: revisedConsent.version,
      expectedContentVersion: 1,
      rating: 4,
      role: "CEO",
      submitterName: "Camille Test",
      text: "The revised story is specific, current, and ready for review.",
      token: managementToken,
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden",
      }),
    ).resolves.toMatchObject({ page: [] });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: submitted.testimonialId,
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden",
      }),
    ).resolves.toMatchObject({
      page: [
        expect.objectContaining({
          company: "North Star Labs",
          text: "The revised story is specific, current, and ready for review.",
        }),
      ],
    });

    await expect(
      t.mutation(api.submissionManagement.withdrawConsent, {
        token: managementToken,
      }),
    ).resolves.toEqual({ withdrawn: true });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden",
      }),
    ).resolves.toMatchObject({ page: [] });
    await expect(
      t.run((ctx) => ctx.db.get(submitted.testimonialId)),
    ).resolves.toBeNull();
  });

  it("collects, publishes, replaces, republishes, and withdraws a fake video without provider credentials", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, {
      email: "video-owner@proof-garden.example",
      name: "Proof Garden Owner",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Proof Garden",
      privacyContact: "privacy@proof-garden.example",
      publicSlug: "proof-garden-video",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "mvp-video-happy-path",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "proof-garden-video",
      spokenLanguage: "fr",
    });
    const initialConsent = consentFor("Remy Test", {
      company: "Signal Works",
      rating: 5,
      role: "Founder",
    });
    const submitted = await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "mvp-video-happy-path",
      company: "Signal Works",
      consentAccepted: true,
      consentText: initialConsent.text,
      consentVersion: initialConsent.version,
      durationSeconds: 48,
      rating: 5,
      reservationId: upload.reservationId,
      role: "Founder",
      submitterEmail: "remy@example.invalid",
      submitterName: "Remy Test",
    });
    expect(submitted).toMatchObject({
      moderationStatus: "pending",
      processingStatus: "ready",
    });
    const privateInbox = await owner.client.query(
      api.testimonialModeration.listInbox,
      {
        organizationId: brand.id,
        paginationOpts: { cursor: null, numItems: 20 },
        sort: "newest",
        submissionType: "video",
      },
    );
    expect(privateInbox.page).toEqual([
      expect.objectContaining({
        moderationStatus: "pending",
        submitterEmail: "remy@example.invalid",
        videoStatus: "ready",
      }),
    ]);

    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: submitted.testimonialId,
    });
    const firstPublication = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "proof-garden-video",
    });
    expect(firstPublication.page).toEqual([
      expect.objectContaining({ name: "Remy Test", type: "video" }),
    ]);
    expect(JSON.stringify(firstPublication)).not.toContain(
      "remy@example.invalid",
    );

    const managementTokenHash =
      await hashSubmissionManagementToken(managementToken);
    await t.run((ctx) =>
      ctx.db.patch(submitted.testimonialId, {
        managementTokenHash,
      }),
    );
    const replacement = await t.action(
      api.submissionManagement.createVideoReplacementUpload,
      {
        expectedContentVersion: 1,
        fileSizeBytes: 3_072,
        mimeType: "video/mp4",
        spokenLanguage: "en",
        token: managementToken,
      },
    );
    const replacementConsent = consentFor("Remy Test", {
      company: "Signal Works",
      rating: 5,
      role: "Founder",
    });
    await t.mutation(api.submissionManagement.confirmRevision, {
      company: "Signal Works",
      consentAccepted: true,
      consentText: replacementConsent.text,
      consentVersion: replacementConsent.version,
      expectedContentVersion: 1,
      rating: 5,
      revisionId: replacement.revisionId,
      role: "Founder",
      submitterName: "Remy Test",
      text: "",
      token: managementToken,
    });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden-video",
      }),
    ).resolves.toMatchObject({ page: [] });
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      status: "published",
      testimonialId: submitted.testimonialId,
    });
    const republished = await t.query(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 20 },
      publicSlug: "proof-garden-video",
    });
    expect(republished.page[0]).toMatchObject({ type: "video" });
    expect(republished.page[0]).not.toEqual(firstPublication.page[0]);

    await expect(
      t.mutation(api.submissionManagement.withdrawConsent, {
        token: managementToken,
      }),
    ).resolves.toEqual({ withdrawn: true });
    const removed = await t.run(async (ctx) => ({
      assets: await ctx.db.query("videoAssets").collect(),
      testimonial: await ctx.db.get(submitted.testimonialId),
    }));
    expect(removed).toEqual({ assets: [], testimonial: null });
    await expect(
      t.query(api.publicWall.list, {
        paginationOpts: { cursor: null, numItems: 20 },
        publicSlug: "proof-garden-video",
      }),
    ).resolves.toMatchObject({ page: [] });
  });
});
