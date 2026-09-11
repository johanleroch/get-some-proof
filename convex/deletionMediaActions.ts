import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { cancelVideoDirectUpload, deleteVideoAsset } from "./videoProvider";

/** Persist one receipt only after the provider confirms deletion (or absence). */
export async function deleteNextMedia(
  ctx: ActionCtx,
  deletionId:
    | Id<"workspaceDeletions">
    | Id<"videoMediaDeletions">
    | Id<"accountDeletions">,
): Promise<boolean> {
  const target = await ctx.runQuery(internal.deletionMedia.next, {
    deletionId,
  });
  if (!target) return false;
  if (target.provider !== "storage") {
    if (target.kind === "upload")
      await cancelVideoDirectUpload(target.resourceId, target.provider);
    else await deleteVideoAsset(target.resourceId, target.provider);
  }
  await ctx.runMutation(internal.deletionMedia.complete, {
    targetId: target.id,
  });
  return true;
}
