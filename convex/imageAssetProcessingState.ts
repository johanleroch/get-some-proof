import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  directImageTarget,
  type DirectImageTarget,
} from "./domain/directImageUpload";
import {
  imageAssetMetadata,
  type ImageAssetMetadataValue,
} from "./domain/imageAsset";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import {
  requireOrganizationCleanupPermission,
  requireOrganizationPermission,
} from "./security/organizationAccess";
import { requireVerifiedPrincipal } from "./security/principal";
import { deleteImageAsset } from "./imageAssetRegistry";

const verificationLifetimeMs = 30 * 60 * 1000;

async function authorizeCleanupTarget(
  ctx: MutationCtx,
  target: DirectImageTarget,
) {
  if (target.kind === "ownerPhoto") {
    await requireVerifiedPrincipal(ctx);
    return;
  }
  if (target.kind === "brandLogo" || target.kind === "videoThumbnail") {
    await requireOrganizationCleanupPermission(
      ctx,
      target.organizationId,
      target.kind === "brandLogo" ? "organization:update" : "ownership:manage",
    );
    return;
  }
  const record = await ctx.db.get(
    target.kind === "submitterPhoto" ? target.reservationId : target.imageId,
  );
  if (!record) throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
}

type AuthorizedImageOwner = {
  organizationId?: Id<"organizations">;
  ownerUserId?: string;
  testimonialId?: Id<"testimonials">;
  testimonialImageId?: Id<"testimonialImages">;
};

async function authorizeTarget(
  ctx: MutationCtx,
  target: DirectImageTarget,
): Promise<AuthorizedImageOwner> {
  if (target.kind === "ownerPhoto") {
    const principal = await requireVerifiedPrincipal(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
      .unique();
    if (account?.deletionStartedAt !== undefined)
      throw new ConvexError({ code: "ACCOUNT_UNAVAILABLE" });
    return { ownerUserId: principal.actorId };
  }
  if (target.kind === "brandLogo") {
    await requireOrganizationPermission(
      ctx,
      { organizationId: target.organizationId },
      "organization:update",
    );
    return { organizationId: target.organizationId };
  }
  if (target.kind === "videoThumbnail") {
    await requireOrganizationPermission(
      ctx,
      { organizationId: target.organizationId },
      "ownership:manage",
    );
    const testimonial = await ctx.db.get(target.testimonialId);
    if (!testimonial || testimonial.organizationId !== target.organizationId)
      throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
    return {
      organizationId: target.organizationId,
      testimonialId: target.testimonialId,
    };
  }
  if (target.kind === "submitterPhoto") {
    const reservation = await ctx.db.get(target.reservationId);
    if (
      !reservation ||
      reservation.storageId ||
      reservation.expiresAt <= Date.now()
    )
      throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
    return { organizationId: reservation.organizationId };
  }
  const image = await ctx.db.get(target.imageId);
  if (!image || image.storageId || image.expiresAt <= Date.now())
    throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
  return {
    organizationId: image.organizationId,
    testimonialImageId: image._id,
  };
}

function sameTarget(left: DirectImageTarget, right: DirectImageTarget) {
  if (left.kind !== right.kind) return false;
  if (left.kind === "ownerPhoto" && right.kind === "ownerPhoto") return true;
  if (left.kind === "brandLogo" && right.kind === "brandLogo")
    return left.organizationId === right.organizationId;
  if (left.kind === "submitterPhoto" && right.kind === "submitterPhoto")
    return left.reservationId === right.reservationId;
  if (left.kind === "testimonialImage" && right.kind === "testimonialImage")
    return left.imageId === right.imageId;
  return (
    left.kind === "videoThumbnail" &&
    right.kind === "videoThumbnail" &&
    left.organizationId === right.organizationId &&
    left.testimonialId === right.testimonialId
  );
}

export const record = internalMutation({
  args: {
    metadata: imageAssetMetadata,
    storageId: v.id("_storage"),
    target: directImageTarget,
    temporaryStorageId: v.id("_storage"),
  },
  returns: v.id("directImageVerifications"),
  handler: async (ctx, args) => {
    const owner = await authorizeTarget(ctx, args.target);
    const temporary = await ctx.db.system.get(
      "_storage",
      args.temporaryStorageId,
    );
    if (
      !temporary ||
      temporary._creationTime < Date.now() - verificationLifetimeMs
    )
      throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
    await validateExclusiveStoredImage(
      ctx,
      args.temporaryStorageId,
      args.target.kind === "ownerPhoto"
        ? { kind: "user", userId: "unattached" }
        : args.target.kind === "brandLogo"
          ? { kind: "organization", organizationId: args.target.organizationId }
          : {
              kind: "testimonial",
              imageKind: args.target.kind,
            },
    );
    const now = Date.now();
    const id = await ctx.db.insert("directImageVerifications", {
      createdAt: now,
      expiresAt: now + verificationLifetimeMs,
      metadata: args.metadata,
      organizationId: owner.organizationId,
      ownerUserId: owner.ownerUserId,
      storageId: args.storageId,
      target: args.target,
    });
    await ctx.storage.delete(args.temporaryStorageId);
    await ctx.scheduler.runAfter(
      verificationLifetimeMs,
      internal.imageAssetProcessingState.expire,
      { verificationId: id },
    );
    return id;
  },
});

export const authorizeTemporary = internalMutation({
  args: {
    target: directImageTarget,
    temporaryStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeTarget(ctx, args.target);
    await validateExclusiveStoredImage(
      ctx,
      args.temporaryStorageId,
      args.target.kind === "ownerPhoto"
        ? { kind: "user", userId: "unattached" }
        : args.target.kind === "brandLogo"
          ? { kind: "organization", organizationId: args.target.organizationId }
          : { kind: "testimonial", imageKind: args.target.kind },
    );
    return null;
  },
});

export const authorizeCleanup = internalMutation({
  args: { target: directImageTarget },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeCleanupTarget(ctx, args.target);
    return null;
  },
});

export async function consumeDirectImage(
  ctx: MutationCtx,
  verificationId: Id<"directImageVerifications">,
  target: DirectImageTarget,
): Promise<{ storageId: Id<"_storage">; metadata: ImageAssetMetadataValue }> {
  const verification = await ctx.db.get(verificationId);
  if (
    !verification ||
    verification.expiresAt <= Date.now() ||
    !sameTarget(verification.target, target)
  )
    throw new ConvexError({
      code: "IMAGE_UPLOAD_UNAVAILABLE",
      message: "The verified image has expired. Upload it again.",
    });
  const owner = await authorizeTarget(ctx, target);
  if (
    verification.ownerUserId !== owner.ownerUserId ||
    verification.organizationId !== owner.organizationId
  )
    throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
  await ctx.db.delete(verification._id);
  return {
    storageId: verification.storageId,
    metadata: verification.metadata,
  };
}

export const expire = internalMutation({
  args: { verificationId: v.id("directImageVerifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return null;
    await deleteImageAsset(ctx, verification.storageId);
    await ctx.db.delete(verification._id);
    return null;
  },
});

export const discardUnrecorded = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("directImageVerifications")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (!verification) await deleteImageAsset(ctx, args.storageId);
    return null;
  },
});

export const discardUnattachedTemporary = internalMutation({
  args: {
    target: directImageTarget,
    temporaryStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stored = await ctx.db.system.get("_storage", args.temporaryStorageId);
    if (!stored || stored._creationTime < Date.now() - verificationLifetimeMs)
      return null;
    const checks = await Promise.all([
      ctx.db
        .query("imageAssets")
        .withIndex("by_storage_id", (q) =>
          q.eq("storageId", args.temporaryStorageId),
        )
        .unique(),
      ctx.db
        .query("importAvatarUploads")
        .withIndex("by_storage_id", (q) =>
          q.eq("storageId", args.temporaryStorageId),
        )
        .first(),
      ctx.db
        .query("testimonialImages")
        .withIndex("by_storage_id", (q) =>
          q.eq("storageId", args.temporaryStorageId),
        )
        .first(),
      ctx.db
        .query("testimonials")
        .withIndex("by_poster_storage_id", (q) =>
          q.eq("posterStorageId", args.temporaryStorageId),
        )
        .first(),
      ctx.db
        .query("userProfiles")
        .withIndex("by_avatar_storage_id", (q) =>
          q.eq("avatarStorageId", args.temporaryStorageId),
        )
        .unique(),
      ctx.db
        .query("organizations")
        .withIndex("by_logo_storage_id", (q) =>
          q.eq("logoStorageId", args.temporaryStorageId),
        )
        .unique(),
      ctx.db
        .query("testimonials")
        .withIndex("by_avatar_storage_id", (q) =>
          q.eq("avatarStorageId", args.temporaryStorageId),
        )
        .unique(),
      ctx.db
        .query("directImageVerifications")
        .withIndex("by_storage_id", (q) =>
          q.eq("storageId", args.temporaryStorageId),
        )
        .unique(),
    ]);
    if (checks.every((reference) => reference === null))
      await ctx.storage.delete(args.temporaryStorageId);
    return null;
  },
});
