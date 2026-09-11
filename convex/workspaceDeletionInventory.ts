import { v } from "convex/values";
import { cancel, type WorkflowId } from "@convex-dev/workflow";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { emptyMediaProgress } from "./domain/mediaDeletionProgress";
import { registerImages, registerVideo } from "./deletionMedia";
import { rememberUnresolvedImportCopy } from "./videoImportCleanup";

const tables = [
  "testimonials",
  "testimonialImages",
  "submissionAvatarUploads",
  "publicTestimonialProjections",
  "videoAssets",
  "videoProviderCleanupJobs",
  "videoMediaDeletions",
] as const;

export const advance = internalMutation({
  args: { deletionId: v.id("workspaceDeletions") },
  returns: v.boolean(),
  handler: async (ctx, { deletionId }) => {
    const deletion = await ctx.db.get(deletionId);
    if (!deletion) throw new Error("Deletion unavailable.");
    if (deletion.mediaInventoryComplete) return true;
    const stage = deletion.inventoryStage ?? 0;
    const cursor = deletion.inventoryCursor ?? null;
    if (stage === 0) {
      await registerImages(
        ctx,
        deletionId,
        await ctx.db.get(deletion.organizationId),
      );
      await ctx.db.patch(deletionId, { inventoryStage: 1 });
      return false;
    }
    if (stage === 1) {
      const page = await ctx.db
        .query("testimonialImportItems")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", deletion.organizationId),
        )
        .paginate({ cursor, numItems: 16 });
      for (const item of page.page) {
        if (item.workflowId)
          await cancel(ctx, components.workflow, item.workflowId as WorkflowId);
        await registerImages(ctx, deletionId, item);
      }
      await ctx.db.patch(deletionId, {
        inventoryStage: page.isDone ? 2 : stage,
        inventoryCursor: page.isDone ? undefined : page.continueCursor,
      });
      return false;
    }
    const table = tables[stage - 2];
    if (!table) {
      const fresh = await ctx.db.get(deletionId);
      await ctx.db.patch(deletionId, {
        mediaInventoryComplete: true,
        mediaProgress: {
          ...(fresh?.mediaProgress ?? emptyMediaProgress()),
          inventoryComplete: true,
        },
        inventoryCursor: undefined,
      });
      return true;
    }
    const page = await ctx.db
      .query(table)
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", deletion.organizationId),
      )
      .paginate({ cursor, numItems: 16 });
    for (const record of page.page) {
      await registerImages(ctx, deletionId, record);
      if ("provider" in record) await registerVideo(ctx, deletionId, record);
      if ("providerAssets" in record) {
        for (const asset of record.providerAssets)
          await registerVideo(ctx, deletionId, asset);
        for (const upload of record.providerUploads ?? [])
          await registerVideo(ctx, deletionId, upload);
      }
      if (table === "videoAssets") {
        const asset = await ctx.db.get(
          "videoAssets",
          record._id as import("./_generated/dataModel").Id<"videoAssets">,
        );
        if (asset) await rememberUnresolvedImportCopy(ctx, asset);
      }
    }
    await ctx.db.patch(deletionId, {
      inventoryStage: page.isDone ? stage + 1 : stage,
      inventoryCursor: page.isDone ? undefined : page.continueCursor,
    });
    return false;
  },
});
