"use node";
import {
  copyPublicVideoToUpload,
  VideoUploadUncertain,
} from "../src/lib/testimonial-import/public-video";
import { createVideoDirectUpload, VideoProviderError } from "./videoProvider";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MediaCopyError } from "../src/lib/testimonial-import/public-media";
import { copyPortraitForImport } from "./importImageProcessing";

export const copyPortrait = internalAction({
  args: {
    itemId: v.id("testimonialImportItems"),
    testimonialId: v.id("testimonials"),
    attempt: v.number(),
    copyAttempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: copyPortraitForImport,
});

export const copyVideo = internalAction({
  args: {
    copyAttempt: v.optional(v.number()),
    assetId: v.id("videoAssets"),
    url: v.string(),
    assistantImport: v.boolean(),
    organizationId: v.id("organizations"),
    reservationId: v.id("videoReservations"),
    provider: v.union(v.literal("fake"), v.literal("mux")),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    let upload: Awaited<ReturnType<typeof createVideoDirectUpload>> | undefined;
    try {
      upload = await createVideoDirectUpload({
        corsOrigin: "*",
        passthrough: args.reservationId,
        organizationId: args.organizationId,
        spokenLanguage: "en",
      });
      await ctx.runMutation(
        internal.testimonialImportVideo.attachAssistantUpload,
        { assetId: args.assetId, providerUploadId: upload.uploadId },
      );
      await copyPublicVideoToUpload(
        args.url,
        upload.uploadUrl,
        async (metadata) => {
          await ctx.runMutation(
            internal.testimonialImportVideo.verifyAssistantFile,
            { assetId: args.assetId, ...metadata },
          );
        },
      );
    } catch (error) {
      if (error instanceof VideoUploadUncertain) return true;
      console.error("Assistant video copy failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage:
          error instanceof Error ? error.message : "Non-error rejection",
        transient:
          error instanceof MediaCopyError || error instanceof VideoProviderError
            ? error.transient
            : undefined,
        diagnostic:
          error instanceof MediaCopyError || error instanceof VideoProviderError
            ? error.diagnostic
            : undefined,
      });
      const attempt = args.copyAttempt ?? 1;
      if (
        (error instanceof MediaCopyError ||
          error instanceof VideoProviderError) &&
        error.transient &&
        attempt < 3
      ) {
        await ctx.runMutation(
          internal.testimonialImportVideo.resetAssistantUpload,
          { assetId: args.assetId },
        );
        await ctx.scheduler.runAfter(
          attempt * 2_000,
          internal.assistantImportMedia.copyVideo,
          { ...args, copyAttempt: attempt + 1 },
        );
        return true;
      }
      await ctx.runMutation(internal.testimonialImportVideo.rejectCopy, {
        assetId: args.assetId,
        reason:
          error instanceof VideoProviderError &&
          error.diagnostic === "direct-upload-capacity-exceeded"
            ? "The connected Mux account is at its video asset limit. Free capacity or upgrade Mux, then retry."
            : "The video could not be copied. Check the public file URL or choose a replacement file.",
      });
    }
    return true;
  },
});
