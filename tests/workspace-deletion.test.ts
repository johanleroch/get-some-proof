import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, components, internal } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Workspace deletion", () => {
  beforeEach(() => {
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
  });

  it("requires the Owner, a fresh session, the exact Brand name, and explicit confirmation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const member = await authenticatedUser(t, {
      email: "admin@example.com",
      name: "Admin User",
    });
    const otherOwner = await authenticatedUser(t, {
      email: "other-owner@example.com",
      name: "Other Owner",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Exact Brand",
      publicSlug: "exact-brand",
    });
    await addMemberWithRole(t, brand.id, member.actorId, "admin");
    await otherOwner.client.mutation(api.organizations.create, {
      name: "Other Brand",
      publicSlug: "other-brand",
    });

    await expect(
      member.client.action(api.workspaceDeletion.remove, {
        brandName: "Exact Brand",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      otherOwner.client.action(api.workspaceDeletion.remove, {
        brandName: "Exact Brand",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_UNAVAILABLE" },
    });
    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "exact brand",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).rejects.toMatchObject({ data: { code: "BRAND_NAME_MISMATCH" } });

    await t.mutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "session",
        update: { createdAt: Date.now() - 6 * 60 * 1_000 },
        where: [{ field: "_id", value: owner.sessionId }],
      },
    });
    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Exact Brand",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).rejects.toMatchObject({ data: { code: "SESSION_NOT_FRESH" } });
  });

  it("exports without mutation, disables public access, and deletes every Workspace record idempotently", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Delete Me",
      publicSlug: "delete-me",
    });
    const { reservationId, testimonialId } = await t.run(async (ctx) => {
      const now = Date.now();
      const id = await ctx.db.insert("testimonials", {
        clientSubmissionId: "workspace-delete-text",
        createdAt: now,
        managementTokenHash: "delete".padEnd(64, "a"),
        moderationStatus: "published",
        organizationId: brand.id,
        submissionType: "text",
        submitterEmail: "private@example.com",
        submitterName: "Private Person",
        text: "Private proof",
        updatedAt: now,
      });
      await ctx.db.insert("publicTestimonialProjections", {
        name: "Private Person",
        organizationId: brand.id,
        publishedAt: now,
        publicOrderKey: "V",
        testimonialId: id,
        text: "Private proof",
        type: "text",
      });
      const reservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: "reserved-before-workspace-delete",
        createdAt: now,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        plan: "premium",
        status: "reserved",
        updatedAt: now,
      });
      return { reservationId, testimonialId: id };
    });

    const exported = await owner.client.action(
      api.workspaceDeletion.exportData,
      {
        organizationId: brand.id,
      },
    );
    expect(exported).toContain("Private proof");
    await expect(
      t.run((ctx) => ctx.db.get(testimonialId)),
    ).resolves.not.toBeNull();

    const prepared = await owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        brandName: "Delete Me",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      },
    );
    await expect(
      t.query(api.publicWall.getBrand, { publicSlug: "delete-me" }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.collectionQuotas.getPublicAvailability, {
        publicSlug: "delete-me",
      }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(api.submissions.generateAvatarUploadUrl, {
        clientSubmissionId: "late-submission",
        publicSlug: "delete-me",
      }),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_FORM_UNAVAILABLE" },
    });
    await expect(
      owner.client.mutation(internal.video.attachProviderUpload, {
        fileSizeBytes: 1_024,
        mimeType: "video/mp4",
        provider: "fake",
        providerUploadId: "upload-after-workspace-delete",
        reservationId,
        spokenLanguage: "fr",
      }),
    ).rejects.toMatchObject({
      data: {
        code: expect.stringMatching(
          /^(COLLECTION_FORM|VIDEO_RESERVATION)_UNAVAILABLE$/,
        ),
      },
    });
    await expect(
      owner.client.mutation(internal.videoMedia.attachDownloadAsset, {
        organizationId: brand.id,
        playbackId: "download-playback-after-workspace-delete",
        provider: "fake",
        providerAssetId: "download-asset-after-workspace-delete",
        testimonialId,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      cleanupJobId: expect.any(String),
      providerAssetId: "download-asset-after-workspace-delete",
    });
    const lateDownloadCleanup = await t.run((ctx) =>
      ctx.db
        .query("videoProviderCleanupJobs")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", brand.id),
        )
        .filter((query) =>
          query.eq(
            query.field("providerAssetId"),
            "download-asset-after-workspace-delete",
          ),
        )
        .unique(),
    );
    expect(lateDownloadCleanup).toMatchObject({
      organizationId: brand.id,
      providerAssetId: "download-asset-after-workspace-delete",
    });
    const replacementRequestId = await owner.client.mutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      {
        email: "private@example.com",
        publicSlug: "delete-me",
        scheduleDelivery: false,
      },
    );
    const replacementRequest = replacementRequestId
      ? await t.run((ctx) => ctx.db.get(replacementRequestId))
      : null;
    expect(replacementRequest).not.toHaveProperty("organizationId");
    expect(replacementRequest).not.toHaveProperty("brandName");

    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Delete Me",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toMatchObject({ deletionId: prepared.deletionId });
    for (let guard = 0; guard < 100; guard += 1) {
      await owner.client.action(internal.workspaceDeletion.processDeletion, {
        deletionId: prepared.deletionId,
      });
      const deletion = await t.run((ctx) => ctx.db.get(prepared.deletionId));
      if (deletion?.status === "deleted") break;
    }
    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Delete Me",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toEqual({ deleted: true, deletionId: prepared.deletionId });

    const remaining = await t.run(async (ctx) => ({
      deletion: await ctx.db.get(prepared.deletionId),
      memberships: await ctx.db.query("memberships").collect(),
      organizations: await ctx.db.query("organizations").collect(),
      projections: await ctx.db.query("publicTestimonialProjections").collect(),
      testimonials: await ctx.db.query("testimonials").collect(),
    }));
    expect(remaining).toEqual({
      deletion: expect.objectContaining({
        phase: "complete",
        status: "deleted",
      }),
      memberships: [],
      organizations: [],
      projections: [],
      testimonials: [],
    });
    await expect(
      owner.client.query(api.workspaceDeletion.getStatus, {
        deletionId: prepared.deletionId,
      }),
    ).resolves.toMatchObject({ phase: "complete", status: "deleted" });

    const lateDownload = await owner.client.mutation(
      internal.videoMedia.attachDownloadAsset,
      {
        organizationId: brand.id,
        playbackId: "download-playback-after-completion",
        provider: "fake",
        providerAssetId: "download-asset-after-completion",
        testimonialId,
      },
    );
    expect(lateDownload).toMatchObject({
      accepted: false,
      cleanupJobId: expect.any(String),
    });
    await expect(
      owner.client.query(api.workspaceDeletion.getStatus, {
        deletionId: prepared.deletionId,
      }),
    ).resolves.toMatchObject({ phase: "providerCleanup", status: "requested" });
    for (let guard = 0; guard < 100; guard += 1) {
      await owner.client.action(internal.workspaceDeletion.processDeletion, {
        deletionId: prepared.deletionId,
      });
      const deletion = await t.run((ctx) => ctx.db.get(prepared.deletionId));
      if (deletion?.status === "deleted") break;
    }
    const completedAgain = await t.run(async (ctx) => ({
      cleanupJob: lateDownload.cleanupJobId
        ? await ctx.db.get(lateDownload.cleanupJobId)
        : null,
      deletion: await ctx.db.get(prepared.deletionId),
    }));
    expect(completedAgain).toEqual({
      cleanupJob: null,
      deletion: expect.objectContaining({
        phase: "complete",
        status: "deleted",
      }),
    });
  });

  it("retains Stripe identifiers across retries and purges synchronized billing traces", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, {
      email: "billing-delete@example.com",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Billing Delete",
      publicSlug: "billing-delete",
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("billingSubscriptionStates", {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(now / 1_000) + 86_400,
        lastStripeEventCreated: Math.floor(now / 1_000),
        lastStripeEventId: "evt_workspace_delete",
        organizationId: brand.id,
        priceId: "price_workspace_delete",
        status: "active",
        stripeCustomerId: "cus_workspace_delete",
        stripeSubscriptionId: "sub_workspace_delete",
        updatedAt: now,
      });
      await ctx.db.insert("stripeWebhookEvents", {
        eventType: "customer.subscription.updated",
        outcome: "applied",
        processedAt: now,
        stripeEventCreated: Math.floor(now / 1_000),
        stripeEventId: "evt_workspace_delete",
        stripeSubscriptionId: "sub_workspace_delete",
      });
      await ctx.db.insert("stripeSubscriptionReconciliations", {
        generation: 1,
        latestEventCreated: Math.floor(now / 1_000),
        latestEventId: "evt_workspace_delete",
        stripeSubscriptionId: "sub_workspace_delete",
        updatedAt: now,
      });
      await ctx.db.insert("stripeInvoicePaymentFailures", {
        firstFailedAt: now,
        lastFailureEventCreated: Math.floor(now / 1_000),
        stripeInvoiceId: "in_workspace_delete",
        stripeSubscriptionId: "sub_workspace_delete",
        updatedAt: now,
      });
    });

    const prepared = await owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        brandName: "Billing Delete",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      },
    );
    expect(prepared.subscriptionIds).toEqual(["sub_workspace_delete"]);
    await expect(
      owner.client.mutation(internal.workspaceDeletion.prepare, {
        brandName: "ignored-on-safe-replay",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toEqual(prepared);
    await expect(
      owner.client.mutation(
        internal.stripeWebhookSync.enqueueSubscriptionEvent,
        {
          eventCreated: Math.floor(Date.now() / 1_000) + 1,
          eventId: "evt_after_workspace_delete",
          eventType: "customer.subscription.deleted",
          stripeSubscriptionId: "sub_workspace_delete",
        },
      ),
    ).resolves.toEqual({ outcome: "ignored" });
    await expect(
      owner.client.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(Date.now() / 1_000),
        eventCreated: Math.floor(Date.now() / 1_000) + 2,
        eventId: "evt_apply_after_workspace_delete",
        eventType: "customer.subscription.deleted",
        organizationId: String(brand.id),
        priceId: "price_workspace_delete",
        status: "canceled",
        stripeCustomerId: "cus_workspace_delete",
        stripeSubscriptionId: "sub_workspace_delete",
      }),
    ).resolves.toEqual({ outcome: "ignored" });
    await expect(
      owner.client.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: Math.floor(Date.now() / 1_000),
        eventCreated: Math.floor(Date.now() / 1_000) + 3,
        eventId: "evt_new_subscription_after_workspace_delete",
        eventType: "customer.subscription.created",
        organizationId: String(brand.id),
        priceId: "price_workspace_delete",
        status: "active",
        stripeCustomerId: "cus_workspace_delete",
        stripeSubscriptionId: "sub_late_workspace_delete",
      }),
    ).resolves.toEqual({ outcome: "ignored" });
    await t.run(async (ctx) => {
      const deletion = await ctx.db.get(prepared.deletionId);
      if (!deletion) throw new Error("Deletion missing");
      const markers = await ctx.db
        .query("workspaceDeletionSubscriptions")
        .withIndex("by_deletion", (index) =>
          index.eq("deletionId", prepared.deletionId),
        )
        .collect();
      expect(
        markers.map((marker) => marker.stripeSubscriptionId).sort(),
      ).toEqual(["sub_late_workspace_delete", "sub_workspace_delete"]);
      for (const marker of markers) {
        await ctx.db.patch(marker._id, { canceledAt: Date.now() });
      }
      await ctx.db.patch(deletion._id, { phase: "managementItems" });
    });

    for (let guard = 0; guard < 100; guard += 1) {
      if (
        await owner.client.mutation(internal.workspaceDeletion.purgeBatch, {
          deletionId: prepared.deletionId,
        })
      ) {
        break;
      }
    }
    const traces = await t.run(async (ctx) => ({
      failures: await ctx.db.query("stripeInvoicePaymentFailures").collect(),
      reconciliations: await ctx.db
        .query("stripeSubscriptionReconciliations")
        .collect(),
      subscriptions: await ctx.db.query("billingSubscriptionStates").collect(),
      webhooks: await ctx.db.query("stripeWebhookEvents").collect(),
    }));
    expect(traces).toEqual({
      failures: [],
      reconciliations: [],
      subscriptions: [],
      webhooks: [],
    });
  });

  it("continues to completion from the durable scheduler without an open browser", async () => {
    vi.useFakeTimers();
    try {
      const t = createConvexTest();
      const owner = await authenticatedUser(t, {
        email: "durable-delete@example.com",
      });
      const brand = await owner.client.mutation(api.organizations.create, {
        name: "Durable Delete",
        publicSlug: "durable-delete",
      });
      const started = await owner.client.mutation(
        internal.workspaceDeletion.prepare,
        {
          brandName: "Durable Delete",
          irreversibleConfirmed: true,
          organizationId: brand.id,
        },
      );
      await t.finishAllScheduledFunctions(() => vi.runAllTimers(), 500);
      await expect(
        t.run((ctx) => ctx.db.get(started.deletionId)),
      ).resolves.toMatchObject({ phase: "complete", status: "deleted" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a failed provider cleanup private and resumes it without restoring the Workspace", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, {
      email: "video-delete@example.com",
    });
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Video Delete",
      publicSlug: "video-delete",
    });
    await t.run(async (ctx) => {
      const now = Date.now();
      const testimonialId = await ctx.db.insert("testimonials", {
        clientSubmissionId: "detached-cleanup-testimonial",
        createdAt: now,
        managementTokenHash: "cleanup".padEnd(64, "a"),
        moderationStatus: "published",
        organizationId: brand.id,
        submissionType: "video",
        submitterEmail: "private@example.com",
        submitterName: "Private Person",
        text: "",
        updatedAt: now,
      });
      await ctx.db.insert("videoProviderCleanupJobs", {
        attempts: 1,
        createdAt: now,
        organizationId: brand.id,
        provider: "mux",
        providerAssetId: "asset-detached-cleanup",
        testimonialId,
      });
      const reservationId = await ctx.db.insert("videoReservations", {
        clientSubmissionId: "workspace-video",
        createdAt: now,
        expiresAt: now + 60_000,
        organizationId: brand.id,
        plan: "premium",
        providerUploadId: "upload-workspace-video",
        status: "consumed",
        updatedAt: now,
      });
      await ctx.db.insert("videoAssets", {
        captionsStatus: "ready",
        createdAt: now,
        fileSizeBytes: 1_024,
        mimeType: "video/mp4",
        organizationId: brand.id,
        playbackId: "playback-workspace-video",
        provider: "mux",
        providerAssetId: "asset-workspace-video",
        providerUploadId: "upload-workspace-video",
        reservationId,
        spokenLanguage: "fr",
        status: "ready",
        updatedAt: now,
      });
    });
    vi.stubEnv("MUX_TOKEN_ID", "mux-test-token");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const started = await owner.client.action(api.workspaceDeletion.remove, {
      brandName: "Video Delete",
      irreversibleConfirmed: true,
      organizationId: brand.id,
    });
    expect(started.deleted).toBe(false);
    await owner.client.action(internal.workspaceDeletion.processDeletion, {
      deletionId: started.deletionId,
    });
    await expect(
      owner.client.query(api.workspaceDeletion.getStatus, {
        deletionId: started.deletionId,
      }),
    ).resolves.toMatchObject({ status: "failed" });
    await expect(
      t.query(api.publicWall.getBrand, { publicSlug: "video-delete" }),
    ).resolves.toBeNull();
    const failed = await t.run((ctx) =>
      ctx.db.query("workspaceDeletions").unique(),
    );
    expect(failed).toMatchObject({ status: "failed" });
    await t.mutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "session",
        update: { createdAt: Date.now() - 6 * 60 * 1_000 },
        where: [{ field: "_id", value: owner.sessionId }],
      },
    });

    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Video Delete",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toMatchObject({ deleted: false });
    for (let guard = 0; guard < 100; guard += 1) {
      await owner.client.action(internal.workspaceDeletion.processDeletion, {
        deletionId: started.deletionId,
      });
      const deletion = await t.run((ctx) => ctx.db.get(started.deletionId));
      if (deletion?.status === "deleted") break;
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/assets/asset-detached-cleanup",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/assets/asset-workspace-video",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
