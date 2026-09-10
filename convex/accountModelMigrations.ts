import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { authzForOrganization } from "./authorization";

const maximumRelatedDocumentsPerTable = 100;

const relatedCountsValidator = v.object({
  billingDowngradeTransitions: v.number(),
  billingProfiles: v.number(),
  billingSubscriptionStates: v.number(),
  collectionCredits: v.number(),
  videoAssets: v.number(),
  videoImportCleanupIntents: v.number(),
  videoProviderCleanupJobs: v.number(),
  videoReservations: v.number(),
  workspaceDeletions: v.number(),
});

type AccountScopedDocument = { accountId?: Id<"accounts"> };

function assertWithinBound(table: string, documents: unknown[]) {
  if (documents.length > maximumRelatedDocumentsPerTable) {
    throw new ConvexError({
      code: "LEGACY_ACCOUNT_MIGRATION_TOO_LARGE",
      message: `${table} exceeds the bounded migration limit.`,
    });
  }
}

function assertAccountCompatible(
  table: string,
  documents: AccountScopedDocument[],
  accountId: Id<"accounts"> | null,
) {
  const conflicting = documents.some(
    (document) =>
      document.accountId !== undefined && document.accountId !== accountId,
  );
  if (conflicting) {
    throw new ConvexError({
      code: "LEGACY_ACCOUNT_CONFLICT",
      message: `${table} already belongs to another Account.`,
    });
  }
}

async function assertSingleBillingProfileAfterMigration(
  ctx: MutationCtx,
  billingProfiles: Array<
    AccountScopedDocument & { _id: Id<"billingProfiles"> }
  >,
  accountId: Id<"accounts"> | null,
) {
  const currentAccountProfiles = accountId
    ? await ctx.db
        .query("billingProfiles")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .take(2)
    : [];
  const prospectiveProfileIds = new Set([
    ...currentAccountProfiles.map((profile) => String(profile._id)),
    ...billingProfiles
      .filter((profile) => profile.accountId === undefined)
      .map((profile) => String(profile._id)),
  ]);
  if (prospectiveProfileIds.size > 1) {
    throw new ConvexError({
      code: "LEGACY_ACCOUNT_CONFLICT",
      message: "The Account would have multiple billing profiles.",
    });
  }
}

async function loadRelatedDocuments(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const limit = maximumRelatedDocumentsPerTable + 1;
  const [
    billingProfiles,
    billingSubscriptionStates,
    billingDowngradeTransitions,
    collectionCredits,
    videoReservations,
    videoAssets,
    videoImportCleanupIntents,
    videoProviderCleanupJobs,
    workspaceDeletions,
  ] = await Promise.all([
    ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("billingDowngradeTransitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("collectionCredits")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("videoReservations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("videoAssets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("videoImportCleanupIntents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("videoProviderCleanupJobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
    ctx.db
      .query("workspaceDeletions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(limit),
  ]);

  const related = {
    billingDowngradeTransitions,
    billingProfiles,
    billingSubscriptionStates,
    collectionCredits,
    videoAssets,
    videoImportCleanupIntents,
    videoProviderCleanupJobs,
    videoReservations,
    workspaceDeletions,
  };
  for (const [table, documents] of Object.entries(related)) {
    assertWithinBound(table, documents);
  }
  return related;
}

function relatedCounts(
  related: Awaited<ReturnType<typeof loadRelatedDocuments>>,
) {
  return {
    billingDowngradeTransitions: related.billingDowngradeTransitions.length,
    billingProfiles: related.billingProfiles.length,
    billingSubscriptionStates: related.billingSubscriptionStates.length,
    collectionCredits: related.collectionCredits.length,
    videoAssets: related.videoAssets.length,
    videoImportCleanupIntents: related.videoImportCleanupIntents.length,
    videoProviderCleanupJobs: related.videoProviderCleanupJobs.length,
    videoReservations: related.videoReservations.length,
    workspaceDeletions: related.workspaceDeletions.length,
  };
}

async function patchMissingAccountIds<T extends AccountScopedDocument>(
  documents: T[],
  patch: (document: T) => Promise<unknown>,
) {
  let updated = 0;
  for (const document of documents) {
    if (document.accountId !== undefined) continue;
    await patch(document);
    updated += 1;
  }
  return updated;
}

/**
 * Reconciles one pre-Account Project after a deployment has adopted the
 * Account-owned billing model. The public slug is an operator-visible stable
 * selector; the mutation derives and verifies ownership from stored data.
 */
export const reconcileLegacyProjectAccount = internalMutation({
  args: {
    dryRun: v.boolean(),
    publicSlug: v.string(),
  },
  returns: v.object({
    attachedOrganization: v.boolean(),
    createdAccount: v.boolean(),
    dryRun: v.boolean(),
    related: relatedCountsValidator,
    updatedRelatedDocuments: v.number(),
  }),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (q) => q.eq("publicSlug", args.publicSlug))
      .unique();
    if (!organization || organization.deletionStartedAt !== undefined) {
      throw new ConvexError({
        code: "LEGACY_PROJECT_UNAVAILABLE",
        message: "Legacy Project unavailable.",
      });
    }

    const ownerUserId = organization.createdByUserId;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", organization._id).eq("userId", ownerUserId),
      )
      .unique();
    const canManageBilling = await authzForOrganization(
      String(organization._id),
    ).can(ctx, ownerUserId, "billing:manage");
    if (membership?.status !== "active" || !canManageBilling) {
      throw new ConvexError({
        code: "LEGACY_PROJECT_OWNER_UNVERIFIED",
        message: "The legacy Project creator is not its active billing Owner.",
      });
    }

    const ownerAccount = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .unique();
    const linkedAccount = organization.accountId
      ? await ctx.db.get(organization.accountId)
      : null;
    if (organization.accountId && !linkedAccount) {
      throw new ConvexError({
        code: "LEGACY_ACCOUNT_CONFLICT",
        message: "The legacy Project references a missing Account.",
      });
    }
    if (
      linkedAccount &&
      (linkedAccount.ownerUserId !== ownerUserId ||
        (ownerAccount && ownerAccount._id !== linkedAccount._id))
    ) {
      throw new ConvexError({
        code: "LEGACY_ACCOUNT_CONFLICT",
        message: "The legacy Project already belongs to another Account.",
      });
    }

    const account = linkedAccount ?? ownerAccount;
    const accountId = account?._id ?? null;
    const related = await loadRelatedDocuments(ctx, organization._id);
    for (const [table, documents] of Object.entries(related)) {
      assertAccountCompatible(table, documents, accountId);
    }
    await assertSingleBillingProfileAfterMigration(
      ctx,
      related.billingProfiles,
      accountId,
    );

    const attachedOrganization = organization.accountId === undefined;
    const createdAccount = account === null;
    if (args.dryRun) {
      return {
        attachedOrganization,
        createdAccount,
        dryRun: true,
        related: relatedCounts(related),
        updatedRelatedDocuments: Object.values(related)
          .flat()
          .filter((document) => document.accountId === undefined).length,
      };
    }

    const resolvedAccountId =
      accountId ??
      (await ctx.db.insert("accounts", {
        createdAt: organization.createdAt,
        ownerUserId,
        updatedAt: Date.now(),
      }));
    if (attachedOrganization) {
      await ctx.db.patch(organization._id, {
        accountId: resolvedAccountId,
        updatedAt: Date.now(),
      });
    }

    let updatedRelatedDocuments = 0;
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.billingProfiles,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.billingSubscriptionStates,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.billingDowngradeTransitions,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.collectionCredits,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.videoReservations,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.videoAssets,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.videoImportCleanupIntents,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.videoProviderCleanupJobs,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );
    updatedRelatedDocuments += await patchMissingAccountIds(
      related.workspaceDeletions,
      (document) =>
        ctx.db.patch(document._id, { accountId: resolvedAccountId }),
    );

    return {
      attachedOrganization,
      createdAccount,
      dryRun: false,
      related: relatedCounts(related),
      updatedRelatedDocuments,
    };
  },
});
