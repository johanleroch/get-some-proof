import type { Id } from "@convex/_generated/dataModel";
import {
  optimizeImageForUpload,
  type ImageAssetKind,
} from "@/lib/image-assets";

export async function uploadProfileImage(
  blob: Blob,
  uploadUrl: string,
  kind: ImageAssetKind,
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
  return { storageId: result.storageId, metadata: optimized.metadata };
}
