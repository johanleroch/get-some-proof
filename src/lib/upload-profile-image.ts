import type { Id } from "@convex/_generated/dataModel";
import type { DirectImageTarget } from "@convex/domain/directImageUpload";
import type { ImageAssetMetadataValue } from "@convex/domain/imageAsset";
import {
  optimizeImageForUpload,
  type ImageAssetKind,
} from "@/lib/image-assets";

export async function uploadProfileImage(
  blob: Blob,
  uploadUrl: string,
  kind: ImageAssetKind,
  processImage: (args: {
    browserMetadata: ImageAssetMetadataValue;
    target: DirectImageTarget;
    temporaryStorageId: Id<"_storage">;
  }) => Promise<{
    metadata: ImageAssetMetadataValue;
    storageId: Id<"_storage">;
    verificationId: Id<"directImageVerifications">;
  }>,
  target: DirectImageTarget,
) {
  const optimized = await optimizeImageForUpload(blob, kind);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": optimized.blob.type },
    body: optimized.blob,
  });
  if (!response.ok) throw new Error("Image upload failed. Please try again.");
  const result = (await response.json()) as { storageId?: Id<"_storage"> };
  if (!result.storageId) throw new Error("Image upload did not finish.");
  return processImage({
    browserMetadata: optimized.metadata,
    target,
    temporaryStorageId: result.storageId,
  });
}
