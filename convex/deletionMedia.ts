import { imageUsedElsewhere } from "./sharedDeletionImages";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { emptyMediaProgress } from "./domain/mediaDeletionProgress";

export const deletionIdValidator = v.union(
  v.id("workspaceDeletions"),
  v.id("videoMediaDeletions"),
  v.id("accountDeletions"),
);
type DeletionId =
  Id<"workspaceDeletions"> | Id<"videoMediaDeletions"> | Id<"accountDeletions">;
type Target = Pick<
  Doc<"deletionMediaTargets">,
  "provider" | "resourceId" | "kind"
>;

async function increment(
  ctx: MutationCtx,
  deletionId: DeletionId,
  kind: Target["kind"],
  completed: boolean,
) {
  const deletion = await ctx.db.get(deletionId);
  if (!deletion) throw new Error("Deletion unavailable.");
  const progress = deletion.mediaProgress ?? emptyMediaProgress();
  const key =
    kind === "image"
      ? completed
        ? "imagesDeleted"
        : "imagesTotal"
      : kind === "video"
        ? completed
          ? "videosDeleted"
          : "videosTotal"
        : completed
          ? "uploadsDeleted"
          : "uploadsTotal";
  await ctx.db.patch(deletionId, {
    mediaProgress: { ...progress, [key]: progress[key] + 1 },
  });
  if ("accountDeletionId" in deletion && deletion.accountDeletionId)
    await increment(ctx, deletion.accountDeletionId, kind, completed);
}

export async function registerMedia(
  ctx: MutationCtx,
  deletionId: DeletionId,
  target: Target,
) {
  const owner = await ctx.db.get(deletionId);
  if (owner && "accountDeletionId" in owner && owner.accountDeletionId) {
    await registerMedia(ctx, owner.accountDeletionId, target);
    return;
  }
  const existing = await ctx.db
    .query("deletionMediaTargets")
    .withIndex("by_deletion_resource", (q) =>
      q
        .eq("deletionId", deletionId)
        .eq("provider", target.provider)
        .eq("kind", target.kind)
        .eq("resourceId", target.resourceId),
    )
    .unique();
  if (existing) return;
  if (target.provider === "storage") {
    const deletion = await ctx.db.get(deletionId);
    if (
      deletion &&
      (await imageUsedElsewhere(
        ctx,
        target.resourceId as Id<"_storage">,
        deletion,
      ))
    ) {
      await ctx.db.insert("deletionMediaTargets", {
        deletionId,
        ...target,
        retained: true,
        deletedAt: Date.now(),
      });
      const progress = deletion.mediaProgress ?? emptyMediaProgress();
      await ctx.db.patch(deletionId, {
        mediaProgress: {
          ...progress,
          imagesShared: (progress.imagesShared ?? 0) + 1,
        },
      });
      return;
    }
  }
  await ctx.db.insert("deletionMediaTargets", { deletionId, ...target });
  await increment(ctx, deletionId, target.kind, false);
}

/** Walk nested import corrections and projections as well as direct image fields. */
export async function registerImages(
  ctx: MutationCtx,
  deletionId: DeletionId,
  value: unknown,
): Promise<void> {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      /^(storageId|avatarStorageId|posterStorageId|logoStorageId)$/.test(key) &&
      typeof child === "string"
    ) {
      const storageId = ctx.db.system.normalizeId("_storage", child);
      if (storageId && (await ctx.db.system.get(storageId)))
        await registerMedia(ctx, deletionId, {
          provider: "storage",
          kind: "image",
          resourceId: storageId,
        });
    } else if (child && typeof child === "object")
      await registerImages(ctx, deletionId, child);
  }
}

export async function registerVideo(
  ctx: MutationCtx,
  deletionId: DeletionId,
  asset: Pick<
    Doc<"videoAssets">,
    | "provider"
    | "providerAssetId"
    | "providerUploadId"
    | "downloadProviderAssetId"
  >,
) {
  for (const id of [asset.providerAssetId, asset.downloadProviderAssetId])
    if (id)
      await registerMedia(ctx, deletionId, {
        provider: asset.provider,
        kind: "video",
        resourceId: id,
      });
  if (asset.providerUploadId && !asset.providerAssetId)
    await registerMedia(ctx, deletionId, {
      provider: asset.provider,
      kind: "upload",
      resourceId: asset.providerUploadId,
    });
}

/** Called with the exact provider snapshot whose deletion just succeeded. */
export async function confirmVideoCleanup(
  ctx: MutationCtx,
  deletionId: DeletionId,
  asset: Parameters<typeof registerVideo>[2],
) {
  const deletion = await ctx.db.get(deletionId);
  const owner =
    deletion && "accountDeletionId" in deletion && deletion.accountDeletionId
      ? deletion.accountDeletionId
      : deletionId;
  await registerVideo(ctx, owner, asset);
  const resources = [
    ...[asset.providerAssetId, asset.downloadProviderAssetId].flatMap((id) =>
      id ? [{ kind: "video" as const, id }] : [],
    ),
    ...(asset.providerUploadId && !asset.providerAssetId
      ? [{ kind: "upload" as const, id: asset.providerUploadId }]
      : []),
  ];
  for (const resource of resources) {
    const target = await ctx.db
      .query("deletionMediaTargets")
      .withIndex("by_deletion_resource", (q) =>
        q
          .eq("deletionId", owner)
          .eq("provider", asset.provider)
          .eq("kind", resource.kind)
          .eq("resourceId", resource.id),
      )
      .unique();
    if (target && target.deletedAt === undefined) {
      await ctx.db.patch(target._id, { deletedAt: Date.now() });
      await increment(ctx, owner, target.kind, true);
    }
  }
}

export const next = internalQuery({
  args: { deletionId: deletionIdValidator },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("deletionMediaTargets"),
      provider: v.union(
        v.literal("storage"),
        v.literal("mux"),
        v.literal("fake"),
      ),
      kind: v.union(
        v.literal("image"),
        v.literal("video"),
        v.literal("upload"),
      ),
      resourceId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const target = await ctx.db
      .query("deletionMediaTargets")
      .withIndex("by_deletion_pending", (q) =>
        q.eq("deletionId", args.deletionId).eq("deletedAt", undefined),
      )
      .first();
    return target
      ? {
          id: target._id,
          provider: target.provider,
          kind: target.kind,
          resourceId: target.resourceId,
        }
      : null;
  },
});

export const complete = internalMutation({
  args: { targetId: v.id("deletionMediaTargets") },
  returns: v.null(),
  handler: async (ctx, { targetId }) => {
    const target = await ctx.db.get(targetId);
    if (!target || target.deletedAt !== undefined) return null;
    if (target.provider === "storage") {
      const storageId = ctx.db.system.normalizeId(
        "_storage",
        target.resourceId,
      );
      if (!storageId) throw new Error("Invalid image reference.");
      const deletion = await ctx.db.get(target.deletionId);
      if (!deletion) throw new Error("Deletion unavailable.");
      if (await imageUsedElsewhere(ctx, storageId, deletion)) {
        const progress = deletion.mediaProgress ?? emptyMediaProgress();
        await ctx.db.patch(targetId, { retained: true, deletedAt: Date.now() });
        await ctx.db.patch(target.deletionId, {
          mediaProgress: {
            ...progress,
            imagesTotal: progress.imagesTotal - 1,
            imagesShared: (progress.imagesShared ?? 0) + 1,
          },
        });
        return null;
      }
      if (await ctx.db.system.get(storageId))
        await ctx.storage.delete(storageId);
    }
    await ctx.db.patch(targetId, { deletedAt: Date.now() });
    await increment(ctx, target.deletionId, target.kind, true);
    return null;
  },
});

export async function assertMediaDeleted(
  ctx: MutationCtx,
  deletionId: DeletionId,
) {
  const deletion = await ctx.db.get(deletionId);
  const pending = await ctx.db
    .query("deletionMediaTargets")
    .withIndex("by_deletion_pending", (q) =>
      q.eq("deletionId", deletionId).eq("deletedAt", undefined),
    )
    .first();
  if (deletion && "accountDeletionId" in deletion && deletion.accountDeletionId)
    await assertMediaDeleted(ctx, deletion.accountDeletionId);
  if (!deletion?.mediaProgress?.inventoryComplete || pending)
    throw new Error("Media cleanup is not complete.");
}
