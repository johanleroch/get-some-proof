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
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "Exact Brand",
      publicSlug: "exact-brand",
    });
    await addMemberWithRole(t, brand.id, member.actorId, "admin");

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
    const testimonialId = await t.run(async (ctx) => {
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
      return id;
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
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Delete Me",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toEqual({ deleted: true, deletionId: prepared.deletionId });
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

    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Video Delete",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).rejects.toThrow("Mux asset deletion failed (503)");
    await expect(
      t.query(api.publicWall.getBrand, { publicSlug: "video-delete" }),
    ).resolves.toBeNull();
    const failed = await t.run((ctx) =>
      ctx.db.query("workspaceDeletions").unique(),
    );
    expect(failed).toMatchObject({ status: "failed" });

    await expect(
      owner.client.action(api.workspaceDeletion.remove, {
        brandName: "Video Delete",
        irreversibleConfirmed: true,
        organizationId: brand.id,
      }),
    ).resolves.toMatchObject({ deleted: true });
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
