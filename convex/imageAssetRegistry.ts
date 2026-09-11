import { ConvexError } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { ImageAssetMetadataValue } from "./domain/imageAsset";
import { imageAssetProfiles } from "../src/lib/image-assets";

type ImageAssetOwner = {
  organizationId?: Id<"organizations">;
  ownerUserId?: string;
  testimonialId?: Id<"testimonials">;
  testimonialImageId?: Id<"testimonialImages">;
};

export async function registerImageAsset(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  metadata: ImageAssetMetadataValue,
  expectedKind: ImageAssetMetadataValue["kind"],
  owner: ImageAssetOwner,
) {
  const stored = await ctx.db.system.get("_storage", storageId);
  const profile = imageAssetProfiles[metadata.kind];
  if (
    !stored ||
    metadata.kind !== expectedKind ||
    (stored.contentType !== undefined && stored.contentType !== "image/webp") ||
    stored.size !== metadata.size ||
    metadata.contentType !== "image/webp" ||
    metadata.size <= 0 ||
    metadata.size > profile.maximumBytes ||
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0 ||
    metadata.width > profile.maxWidth ||
    metadata.height > profile.maxHeight ||
    !Number.isSafeInteger(metadata.originalSize) ||
    metadata.originalSize <= 0
  )
    throw new ConvexError({
      code: "INVALID_IMAGE_ASSET",
      message: "The image could not be verified. Upload it again.",
    });
  const existing = await ctx.db
    .query("imageAssets")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .unique();
  if (existing) {
    const sameOwner =
      existing.kind === expectedKind &&
      existing.organizationId === owner.organizationId &&
      existing.ownerUserId === owner.ownerUserId &&
      existing.testimonialId === owner.testimonialId &&
      existing.testimonialImageId === owner.testimonialImageId;
    if (!sameOwner)
      throw new ConvexError({
        code: "IMAGE_ASSET_ALREADY_ATTACHED",
        message: "That image is already in use.",
      });
    return existing._id;
  }
  const now = Date.now();
  return await ctx.db.insert("imageAssets", {
    ...owner,
    ...metadata,
    status: "attached",
    storageId,
    attachedAt: now,
    createdAt: now,
  });
}

export async function deleteImageAsset(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const asset = await ctx.db
    .query("imageAssets")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .unique();
  if (asset)
    await ctx.db.patch(asset._id, {
      deletedAt: Date.now(),
      status: "deleted",
      storageId: undefined,
    });
  await ctx.storage.delete(storageId);
}

export async function attachImageAssetToTestimonial(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  testimonialId: Id<"testimonials">,
) {
  const asset = await ctx.db
    .query("imageAssets")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .unique();
  if (!asset || asset.status !== "attached")
    throw new ConvexError({
      code: "IMAGE_ASSET_UNAVAILABLE",
      message: "The image is unavailable. Upload it again.",
    });
  if (asset.testimonialId && asset.testimonialId !== testimonialId)
    throw new ConvexError({
      code: "IMAGE_ASSET_ALREADY_ATTACHED",
      message: "That image is already in use.",
    });
  const testimonial = await ctx.db.get(testimonialId);
  if (!testimonial) throw new ConvexError({ code: "IMAGE_ASSET_UNAVAILABLE" });
  if (
    asset.organizationId &&
    asset.organizationId !== testimonial.organizationId
  )
    throw new ConvexError({ code: "IMAGE_ASSET_ALREADY_ATTACHED" });
  if (!asset.testimonialId || !asset.organizationId)
    await ctx.db.patch(asset._id, {
      testimonialId,
      organizationId: testimonial.organizationId,
    });
}
