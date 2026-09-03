import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const maximumStoredImageBytes = 5 * 1024 * 1024;

type ImageOwner =
  | { kind: "user"; userId: string }
  | { kind: "organization"; organizationId: Id<"organizations"> };

export async function validateExclusiveStoredImage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  owner: ImageOwner,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (
    !metadata ||
    !metadata.contentType?.startsWith("image/") ||
    metadata.size > maximumStoredImageBytes
  ) {
    throw new ConvexError({
      code: "INVALID_STORED_IMAGE",
      message: "Choose an image smaller than 5 MB.",
    });
  }

  const [profile, organization] = await Promise.all([
    ctx.db
      .query("userProfiles")
      .withIndex("by_avatar_storage_id", (index) =>
        index.eq("avatarStorageId", storageId),
      )
      .unique(),
    ctx.db
      .query("organizations")
      .withIndex("by_logo_storage_id", (index) =>
        index.eq("logoStorageId", storageId),
      )
      .unique(),
  ]);

  const belongsToOwner =
    (owner.kind === "user" &&
      profile?.userId === owner.userId &&
      organization === null) ||
    (owner.kind === "organization" &&
      organization?._id === owner.organizationId &&
      profile === null) ||
    (profile === null && organization === null);

  if (!belongsToOwner) {
    throw new ConvexError({
      code: "STORED_IMAGE_UNAVAILABLE",
      message: "That image is already in use.",
    });
  }
}
