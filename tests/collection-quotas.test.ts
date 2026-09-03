import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "@convex/_generated/api";
import {
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("collection quota transitions", () => {
  beforeEach(() => {
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_collection_quotas");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_collection_quotas");
  });

  it("preserves lifetime Free text usage through upgrade and downgrade", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 13; index += 1) {
        const testimonialId = await ctx.db.insert("testimonials", {
          clientSubmissionId: `lifetime-text-${index}`,
          createdAt: now,
          managementTokenHash: String(index).padStart(64, "a"),
          moderationStatus: "archived",
          organizationId: brand.id,
          submissionType: "text",
          submitterEmail: `submitter-${index}@example.invalid`,
          submitterName: `Submitter ${index}`,
          text: "A valid historical testimonial consumed this lifetime credit.",
          updatedAt: now,
        });
        await ctx.db.insert("collectionCredits", {
          consumedAt: now,
          organizationId: brand.id,
          submissionType: "text",
          testimonialId,
        });
      }
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ textAvailable: false });

    await addStripeSubscription(t, String(brand.id), "active");
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ textAvailable: true });
    await t.mutation(components.stripe.private.handleSubscriptionUpdated, {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: Math.floor(Date.now() / 1_000),
      metadata: { lookupKey: "premium_monthly", orgId: String(brand.id) },
      status: "canceled",
      stripeSubscriptionId: `sub_${String(brand.id)}`,
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ textAvailable: false });
  });

  it("counts every stored Ready Pro video and frees only a deleted slot", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    await addStripeSubscription(t, String(brand.id), "active");
    const first = await t.run(async (ctx) => {
      const now = Date.now();
      let firstIds:
        | { assetId: string; reservationId: string; testimonialId: string }
        | undefined;
      for (let index = 0; index < 25; index += 1) {
        const testimonialId = await ctx.db.insert("testimonials", {
          clientSubmissionId: `ready-video-${index}`,
          createdAt: now,
          managementTokenHash: String(index).padStart(64, "b"),
          moderationStatus:
            index % 3 === 0
              ? "published"
              : index % 3 === 1
                ? "pending"
                : "archived",
          organizationId: brand.id,
          submissionType: "video",
          submitterEmail: `video-${index}@example.invalid`,
          submitterName: `Video ${index}`,
          text: "",
          updatedAt: now,
        });
        const reservationId = await ctx.db.insert("videoReservations", {
          clientSubmissionId: `ready-video-${index}`,
          createdAt: now,
          expiresAt: now,
          organizationId: brand.id,
          plan: "premium",
          status: "consumed",
          updatedAt: now,
        });
        const assetId = await ctx.db.insert("videoAssets", {
          captionsStatus: "ready",
          createdAt: now,
          fileSizeBytes: 2_048,
          mimeType: "video/mp4",
          organizationId: brand.id,
          playbackId: `playback-${index}`,
          provider: "fake",
          providerAssetId: `asset-${index}`,
          providerUploadId: `upload-${index}`,
          reservationId,
          spokenLanguage: "en",
          status: "ready",
          testimonialId,
          updatedAt: now,
        });
        if (index === 0) {
          firstIds = {
            assetId: String(assetId),
            reservationId: String(reservationId),
            testimonialId: String(testimonialId),
          };
        }
      }
      return firstIds!;
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ videoAvailable: false });

    await t.run(async (ctx) => {
      const assetId = ctx.db.normalizeId("videoAssets", first.assetId)!;
      const reservationId = ctx.db.normalizeId(
        "videoReservations",
        first.reservationId,
      )!;
      const testimonialId = ctx.db.normalizeId(
        "testimonials",
        first.testimonialId,
      )!;
      await ctx.db.delete(assetId);
      await ctx.db.delete(reservationId);
      await ctx.db.delete(testimonialId);
    });
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "acme-proof",
      }),
    ).resolves.toMatchObject({ videoAvailable: true });
  });

  it("uses the reservation plan when Ready races upgrade and downgrade", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const insertProcessingVideo = async (
      suffix: string,
      plan: "free" | "premium",
    ) =>
      await t.run(async (ctx) => {
        const now = Date.now();
        const testimonialId = await ctx.db.insert("testimonials", {
          clientSubmissionId: `plan-race-${suffix}`,
          createdAt: now,
          managementTokenHash: suffix.padEnd(64, "c").slice(0, 64),
          moderationStatus: "pending",
          organizationId: brand.id,
          submissionType: "video",
          submitterEmail: `${suffix}@example.invalid`,
          submitterName: `Plan ${suffix}`,
          text: "",
          updatedAt: now,
        });
        const reservationId = await ctx.db.insert("videoReservations", {
          clientSubmissionId: `plan-race-${suffix}`,
          createdAt: now,
          expiresAt: now + 60_000,
          organizationId: brand.id,
          plan,
          status: "reserved",
          updatedAt: now,
        });
        await ctx.db.insert("videoAssets", {
          captionsStatus: "requested",
          createdAt: now,
          fileSizeBytes: 2_048,
          mimeType: "video/mp4",
          organizationId: brand.id,
          provider: "fake",
          providerUploadId: `upload-${suffix}`,
          reservationId,
          spokenLanguage: "en",
          status: "processing",
          testimonialId,
          updatedAt: now,
        });
        return testimonialId;
      });

    const freeTestimonialId = await insertProcessingVideo("upgrade", "free");
    await Promise.all([
      addStripeSubscription(t, String(brand.id), "active"),
      t.mutation(internal.video.completeFakeAsset, {
        testimonialId: freeTestimonialId,
      }),
    ]);
    const premiumTestimonialId = await insertProcessingVideo(
      "downgrade",
      "premium",
    );
    await Promise.all([
      t.mutation(components.stripe.private.handleSubscriptionUpdated, {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(Date.now() / 1_000),
        metadata: { lookupKey: "premium_monthly", orgId: String(brand.id) },
        status: "canceled",
        stripeSubscriptionId: `sub_${String(brand.id)}`,
      }),
      t.mutation(internal.video.completeFakeAsset, {
        testimonialId: premiumTestimonialId,
      }),
    ]);

    const state = await t.run(async (ctx) => ({
      credits: await ctx.db.query("collectionCredits").collect(),
      readyAssets: await ctx.db
        .query("videoAssets")
        .withIndex("by_organization_status", (index) =>
          index.eq("organizationId", brand.id).eq("status", "ready"),
        )
        .collect(),
    }));
    expect(state.readyAssets).toHaveLength(2);
    expect(state.credits).toHaveLength(1);
    expect(state.credits[0]?.testimonialId).toBe(freeTestimonialId);
  });
});
