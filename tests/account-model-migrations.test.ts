import { expect, it } from "vitest";

import { internal } from "@convex/_generated/api";
import { authzForOrganization } from "@convex/authorization";
import { createConvexTest } from "./convex-test-helpers";

async function legacyProjectFixture() {
  const t = createConvexTest();
  const ownerUserId = "legacy-owner";
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      collectionFormDescription: "Tell us what changed.",
      collectionFormTitle: "Share your story",
      createdAt: now,
      createdByUserId: ownerUserId,
      name: "Legacy Studio",
      primaryColor: "#ffbb16",
      privacyContact: "privacy@example.com",
      publicSlug: "legacy-studio",
      slug: "legacy-studio-abcd",
      updatedAt: now,
    });
    await ctx.db.insert("memberships", {
      createdAt: now,
      organizationId,
      status: "active",
      updatedAt: now,
      userId: ownerUserId,
    });
    await authzForOrganization(String(organizationId)).assignRole(
      ctx,
      ownerUserId,
      "owner",
      undefined,
      undefined,
      ownerUserId,
    );
    const billingProfileId = await ctx.db.insert("billingProfiles", {
      billingEmail: "billing@example.com",
      createdAt: now,
      organizationId,
      updatedAt: now,
    });
    const testimonialId = await ctx.db.insert("testimonials", {
      clientSubmissionId: "legacy-proof",
      createdAt: now,
      moderationStatus: "published",
      organizationId,
      submissionType: "video",
      submitterName: "Customer",
      text: "This helped.",
      updatedAt: now,
    });
    const creditId = await ctx.db.insert("collectionCredits", {
      consumedAt: now,
      organizationId,
      submissionType: "video",
      testimonialId,
    });
    const reservationId = await ctx.db.insert("videoReservations", {
      clientSubmissionId: "legacy-proof",
      createdAt: now,
      expiresAt: now + 60_000,
      organizationId,
      plan: "premium",
      status: "consumed",
      updatedAt: now,
    });
    const assetId = await ctx.db.insert("videoAssets", {
      captionsStatus: "ready",
      createdAt: now,
      mimeType: "video/mp4",
      organizationId,
      provider: "fake",
      reservationId,
      status: "ready",
      testimonialId,
      updatedAt: now,
    });
    return {
      assetId,
      billingProfileId,
      creditId,
      organizationId,
      ownerUserId,
      reservationId,
    };
  });
  return { ids, t };
}

it("previews and idempotently reconciles a legacy Project Account", async () => {
  const { ids, t } = await legacyProjectFixture();

  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: true,
      publicSlug: "legacy-studio",
    }),
  ).resolves.toMatchObject({
    attachedOrganization: true,
    createdAccount: true,
    dryRun: true,
    related: {
      billingProfiles: 1,
      collectionCredits: 1,
      videoAssets: 1,
      videoReservations: 1,
    },
    updatedRelatedDocuments: 4,
  });
  await expect(
    t.run((ctx) => ctx.db.query("accounts").collect()),
  ).resolves.toEqual([]);

  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: false,
      publicSlug: "legacy-studio",
    }),
  ).resolves.toMatchObject({
    attachedOrganization: true,
    createdAccount: true,
    dryRun: false,
    updatedRelatedDocuments: 4,
  });

  const account = await t.run((ctx) =>
    ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ids.ownerUserId))
      .unique(),
  );
  expect(account).not.toBeNull();
  await t.run(async (ctx) => {
    await expect(ctx.db.get(ids.organizationId)).resolves.toMatchObject({
      accountId: account!._id,
    });
    await expect(ctx.db.get(ids.billingProfileId)).resolves.toMatchObject({
      accountId: account!._id,
    });
    await expect(ctx.db.get(ids.creditId)).resolves.toMatchObject({
      accountId: account!._id,
    });
    await expect(ctx.db.get(ids.reservationId)).resolves.toMatchObject({
      accountId: account!._id,
    });
    await expect(ctx.db.get(ids.assetId)).resolves.toMatchObject({
      accountId: account!._id,
    });
  });

  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: false,
      publicSlug: "legacy-studio",
    }),
  ).resolves.toMatchObject({
    attachedOrganization: false,
    createdAccount: false,
    updatedRelatedDocuments: 0,
  });
  await expect(
    t.run((ctx) => ctx.db.query("accounts").collect()),
  ).resolves.toHaveLength(1);
});

it("refuses a legacy Project whose creator is not the billing Owner", async () => {
  const { ids, t } = await legacyProjectFixture();
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q
          .eq("organizationId", ids.organizationId)
          .eq("userId", ids.ownerUserId),
      )
      .unique();
    await ctx.db.patch(membership!._id, { status: "inactive" });
  });
  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: false,
      publicSlug: "legacy-studio",
    }),
  ).rejects.toThrow("creator is not its active billing Owner");
});

it("refuses a legacy Project that references a missing Account", async () => {
  const { ids, t } = await legacyProjectFixture();
  await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      createdAt: Date.now(),
      ownerUserId: ids.ownerUserId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(ids.organizationId, { accountId });
    await ctx.db.delete(accountId);
  });

  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: false,
      publicSlug: "legacy-studio",
    }),
  ).rejects.toThrow("references a missing Account");
});

it("refuses to create a second billing profile for an existing Account", async () => {
  const { ids, t } = await legacyProjectFixture();
  await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = await ctx.db.insert("accounts", {
      createdAt: now,
      ownerUserId: ids.ownerUserId,
      updatedAt: now,
    });
    const otherOrganizationId = await ctx.db.insert("organizations", {
      accountId,
      collectionFormDescription: "Tell us what changed.",
      collectionFormTitle: "Share your story",
      createdAt: now,
      createdByUserId: ids.ownerUserId,
      name: "Current Studio",
      primaryColor: "#ffbb16",
      privacyContact: "privacy@example.com",
      publicSlug: "current-studio",
      slug: "current-studio-abcd",
      updatedAt: now,
    });
    await ctx.db.insert("billingProfiles", {
      accountId,
      billingEmail: "current@example.com",
      createdAt: now,
      organizationId: otherOrganizationId,
      updatedAt: now,
    });
  });

  await expect(
    t.mutation(internal.accountModelMigrations.reconcileLegacyProjectAccount, {
      dryRun: true,
      publicSlug: "legacy-studio",
    }),
  ).rejects.toThrow("multiple billing profiles");
  const legacyOrganization = await t.run((ctx) =>
    ctx.db.get(ids.organizationId),
  );
  expect(legacyOrganization?.accountId).toBeUndefined();
});
