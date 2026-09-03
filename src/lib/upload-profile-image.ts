import type { Id } from "@convex/_generated/dataModel";

export async function uploadProfileImage(blob: Blob, uploadUrl: string) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!response.ok) throw new Error("Image upload failed. Please try again.");
  const result = (await response.json()) as { storageId?: Id<"_storage"> };
  if (!result.storageId) throw new Error("Image upload did not finish.");
  return result.storageId;
}
