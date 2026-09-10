import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { listMuxImportCandidates } from "./videoProvider";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { enqueueAssetCleanup } from "./testimonialDeletion";

/** Re-check at deletion commit: a provider response may follow its earlier snapshot. */
export async function preserveImportCopyCleanup(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
) {
  if (!asset.importItemId) return;
  await rememberUnresolvedImportCopy(ctx, asset);
  if (asset.providerAssetId)
    await enqueueAssetCleanup(ctx, {
      accountId: asset.accountId,
      organizationId: asset.organizationId,
      provider: asset.provider,
      providerAssetId: asset.providerAssetId,
    });
}

/** Survives deletion of private proof and reservation records until Mux answers. */
export async function rememberUnresolvedImportCopy(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
) {
  if (
    !asset.importItemId ||
    asset.importCopyStartedAt === undefined ||
    asset.providerAssetId
  )
    return;
  const existing = await ctx.db
    .query("videoImportCleanupIntents")
    .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
    .unique();
  if (existing) return;
  await ctx.db.insert("videoImportCleanupIntents", {
    accountId: asset.accountId,
    organizationId: asset.organizationId,
    assetId: asset._id,
    reservationId: asset.reservationId,
    provider: asset.provider,
    createdAt: Date.now(),
    nextAttemptAt: Date.now(),
  });
}

/** Transfer the held capacity to durable provider cleanup in one transaction. */
export async function resolveImportCleanup(
  ctx: MutationCtx,
  reservationId: Id<"videoReservations">,
  providerAssetId: string,
) {
  const intent = await ctx.db
    .query("videoImportCleanupIntents")
    .withIndex("by_reservation", (q) => q.eq("reservationId", reservationId))
    .unique();
  if (!intent) return false;
  await enqueueAssetCleanup(ctx, {
    accountId: intent.accountId,
    organizationId: intent.organizationId,
    provider: intent.provider,
    providerAssetId,
  });
  await ctx.db.delete(intent._id);
  return true;
}

const probeArgs = {
  intentId: v.id("videoImportCleanupIntents"),
  probe: v.number(),
};

/** Durable lease: the cron can recover an action that stops before its commit. */
export const reconcileDue = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const due = await ctx.db
      .query("videoImportCleanupIntents")
      .withIndex("by_nextAttemptAt", (q) => q.lte("nextAttemptAt", Date.now()))
      .take(10);
    for (const intent of due) {
      const probe = (intent.probe ?? 0) + 1;
      await ctx.db.patch(intent._id, {
        probe,
        nextAttemptAt: Date.now() + 120_000,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.videoImportCleanup.probeInventory,
        { intentId: intent._id, probe },
      );
    }
    return due.length;
  },
});

export const probeContext = internalQuery({
  args: probeArgs,
  returns: v.union(v.null(), schema.doc("videoImportCleanupIntents")),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    return intent?.probe === args.probe ? intent : null;
  },
});

export const finishProbe = internalMutation({
  args: {
    ...probeArgs,
    matches: v.array(v.object({ id: v.string(), passthrough: v.string() })),
    nextCursor: v.union(v.string(), v.null()),
    failed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.intentId);
    if (!intent || intent.probe !== args.probe) return null;
    if (
      args.matches.length > 100 ||
      args.matches.some(
        (asset) =>
          asset.passthrough !== intent.reservationId ||
          !asset.id ||
          asset.id.length > 255,
      )
    )
      throw new Error("Import reconciliation reference mismatch.");
    if (args.matches.length) {
      for (const asset of args.matches)
        await enqueueAssetCleanup(ctx, {
          accountId: intent.accountId,
          organizationId: intent.organizationId,
          provider: intent.provider,
          providerAssetId: asset.id,
        });
      await ctx.db.delete(intent._id);
      return null;
    }
    const completedScans =
      (intent.completedScans ?? 0) + (!args.failed && !args.nextCursor ? 1 : 0);
    const failures = args.failed ? (intent.failures ?? 0) + 1 : 0;
    const delay = args.failed
      ? Math.min(3600000, 60000 * 2 ** Math.min(failures - 1, 6))
      : args.nextCursor
        ? 1000
        : Math.min(21600000, 600000 * 2 ** Math.min(completedScans - 1, 6));
    await ctx.db.patch(intent._id, {
      nextAttemptAt: Date.now() + delay,
      cursor: args.failed ? undefined : (args.nextCursor ?? undefined),
      completedScans,
      failures,
      lastCheckedAt: Date.now(),
      lastScanCompletedAt:
        !args.failed && !args.nextCursor
          ? Date.now()
          : intent.lastScanCompletedAt,
      reviewRequiredAt:
        intent.reviewRequiredAt ??
        (completedScans >= 3 || failures >= 3 ? Date.now() : undefined),
      lastError: args.failed
        ? "Mux inventory unavailable. The copy remains unresolved."
        : undefined,
    });
    if (!args.failed && args.nextCursor)
      await ctx.scheduler.runAfter(
        delay,
        internal.videoImportCleanup.reconcileDue,
        {},
      );
    return null;
  },
});

export const probeInventory = internalAction({
  args: probeArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.runQuery(
      internal.videoImportCleanup.probeContext,
      args,
    );
    if (!intent) return null;
    try {
      const page =
        intent.provider === "fake"
          ? {
              assets: [
                {
                  id: `fake-import-${intent.reservationId}`,
                  passthrough: String(intent.reservationId),
                },
              ],
              nextCursor: null,
            }
          : await listMuxImportCandidates(intent.cursor);
      if (page.nextCursor && page.nextCursor === intent.cursor)
        throw new Error("Mux cursor did not advance.");
      await ctx.runMutation(internal.videoImportCleanup.finishProbe, {
        ...args,
        matches: page.assets
          .filter((asset) => asset.passthrough === intent.reservationId)
          .map((asset) => ({
            id: asset.id,
            passthrough: String(intent.reservationId),
          })),
        nextCursor: page.nextCursor,
        failed: false,
      });
    } catch {
      await ctx.runMutation(internal.videoImportCleanup.finishProbe, {
        ...args,
        matches: [],
        nextCursor: null,
        failed: true,
      });
    }
    return null;
  },
});

/** Operator-only, paginated state; no source URLs, names or account credentials. */
export const unresolved = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("videoImportCleanupIntents")),
  handler: async (ctx, args) => {
    if (args.paginationOpts.numItems > 100)
      throw new Error("Request at most 100 unresolved copies.");
    return ctx.db
      .query("videoImportCleanupIntents")
      .withIndex("by_nextAttemptAt")
      .paginate(args.paginationOpts);
  },
});
