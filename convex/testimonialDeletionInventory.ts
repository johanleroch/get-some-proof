import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { emptyMediaProgress } from "./domain/mediaDeletionProgress";
import { registerImages, registerVideo } from "./deletionMedia";
import { rememberUnresolvedImportCopy } from "./videoImportCleanup";

export const advance = internalMutation({
  args: { deletionId: v.id("videoMediaDeletions") },
  returns: v.boolean(),
  handler: async (ctx, { deletionId }) => {
    const deletion = await ctx.db.get(deletionId);
    if (!deletion) throw new Error("Deletion unavailable.");
    const stage = deletion.inventoryStage ?? 0;
    const opts = { cursor: deletion.inventoryCursor ?? null, numItems: 16 };
    const id = deletion.testimonialId;
    if (stage > 4) {
      await ctx.db.patch(deletionId, {
        mediaProgress: {
          ...(deletion.mediaProgress ?? emptyMediaProgress()),
          inventoryComplete: true,
        },
      });
      return true;
    }
    const page =
      stage === 0
        ? await ctx.db
            .query("videoRetryLinks")
            .withIndex("by_testimonial", (q) => q.eq("testimonialId", id))
            .paginate(opts)
        : stage === 1
          ? await ctx.db
              .query("submissionVideoRevisions")
              .withIndex("by_testimonial_status", (q) =>
                q.eq("testimonialId", id),
              )
              .paginate(opts)
          : stage === 2
            ? await ctx.db
                .query("testimonialImportItems")
                .withIndex("by_testimonialId", (q) => q.eq("testimonialId", id))
                .paginate(opts)
            : stage === 3
              ? await ctx.db
                  .query("testimonialImages")
                  .withIndex("by_testimonial", (q) => q.eq("testimonialId", id))
                  .paginate(opts)
              : await ctx.db
                  .query("testimonialImages")
                  .withIndex("by_management_testimonial", (q) =>
                    q.eq("managementTestimonialId", id),
                  )
                  .paginate(opts);
    for (const record of page.page) {
      await registerImages(ctx, deletionId, record);
      if ("videoAssetId" in record && record.videoAssetId) {
        const asset = await ctx.db.get(record.videoAssetId);
        if (asset) {
          await registerVideo(ctx, deletionId, asset);
          await rememberUnresolvedImportCopy(ctx, asset);
          const unresolved = await ctx.db
            .query("videoImportCleanupIntents")
            .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
            .first();
          if (unresolved)
            throw new Error(
              "Waiting for the video provider to confirm cleanup.",
            );
        }
      }
    }
    await ctx.db.patch(deletionId, {
      inventoryStage: page.isDone ? stage + 1 : stage,
      inventoryCursor: page.isDone ? undefined : page.continueCursor,
    });
    return false;
  },
});
