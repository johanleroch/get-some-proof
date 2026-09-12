"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { importSubmitterPhotoTarget } from "./domain/importSubmitterPhoto";
import {
  downloadImportAvatar,
  ImportAvatarError,
} from "../src/lib/testimonial-import/avatar";
import {
  downloadPublicPortrait,
  MediaCopyError,
} from "../src/lib/testimonial-import/public-media";
import {
  normalizeStoredImage,
  StoredImageNormalizationError,
} from "./lib/normalizeImage";

const copyArgs = {
  attempt: v.number(),
  itemId: v.id("testimonialImportItems"),
  testimonialId: v.id("testimonials"),
};

export async function copyPortraitForImport(
  ctx: ActionCtx,
  args: {
    attempt: number;
    copyAttempt?: number;
    itemId: Id<"testimonialImportItems">;
    testimonialId: Id<"testimonials">;
  },
): Promise<null> {
  const source = await ctx.runQuery(
    internal.testimonialImportAvatar.source,
    args,
  );
  if (!source || source.provider === "backup") return null;
  let storageId: Id<"_storage"> | undefined;
  try {
    const input =
      source.provider === "assistant"
        ? await downloadPublicPortrait(source.url)
        : await downloadImportAvatar(source.provider, source.url);
    const normalized = await normalizeStoredImage(
      input,
      "submitterPhoto",
      "import",
    );
    storageId = await ctx.storage.store(
      new Blob([normalized.bytes], { type: "image/webp" }),
    );
    await ctx.runMutation(internal.testimonialImportAvatar.finish, {
      attempt: args.attempt,
      itemId: args.itemId,
      testimonialId: args.testimonialId,
      sourceUrl: source.url,
      storageId,
      metadata: normalized.metadata,
    });
    return null;
  } catch (error) {
    const copyAttempt = args.copyAttempt ?? 1;
    if (error instanceof MediaCopyError && error.transient && copyAttempt < 3) {
      await ctx.scheduler.runAfter(
        copyAttempt * 2_000,
        internal.importImageProcessing.copyPortrait,
        { ...args, copyAttempt: copyAttempt + 1 },
      );
      return null;
    }
    await ctx.runMutation(internal.testimonialImportAvatar.finish, {
      attempt: args.attempt,
      itemId: args.itemId,
      testimonialId: args.testimonialId,
      sourceUrl: source.url,
      diagnostic:
        error instanceof StoredImageNormalizationError
          ? error.diagnostic
          : error instanceof ImportAvatarError
            ? error.diagnostic
            : "COPY_FAILED",
    });
    return null;
  }
}

export const copyPortrait = internalAction({
  args: { ...copyArgs, copyAttempt: v.optional(v.number()) },
  returns: v.null(),
  handler: copyPortraitForImport,
});

export const uploadCorrection = internalAction({
  args: { target: importSubmitterPhotoTarget, bytes: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const normalized = await normalizeStoredImage(
      new Blob([args.bytes]),
      "submitterPhoto",
      "direct",
    ).catch((error) => {
      throw new Error(
        error instanceof StoredImageNormalizationError
          ? error.diagnostic
          : "IMAGE_OPTIMIZATION_FAILED",
      );
    });
    const storageId = await ctx.storage.store(
      new Blob([normalized.bytes], { type: "image/webp" }),
    );
    try {
      await ctx.runMutation(internal.importAvatarUpload.attach, {
        target: args.target,
        storageId,
        metadata: normalized.metadata,
      });
    } catch (error) {
      await ctx.runMutation(internal.importAvatarUpload.discardUnattached, {
        storageId,
      });
      throw error;
    }
    return null;
  },
});

export const uploadStoredCorrection = internalAction({
  args: {
    target: importSubmitterPhotoTarget,
    temporaryStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = await ctx.storage.get(args.temporaryStorageId);
    if (!input) throw new Error("IMAGE_UPLOAD_UNAVAILABLE");
    let storageId: Id<"_storage"> | undefined;
    try {
      const normalized = await normalizeStoredImage(
        input,
        "submitterPhoto",
        "direct",
      );
      storageId = await ctx.storage.store(
        new Blob([normalized.bytes], { type: "image/webp" }),
      );
      await ctx.runMutation(internal.importAvatarUpload.attach, {
        target: args.target,
        storageId,
        metadata: normalized.metadata,
      });
      await ctx.runMutation(internal.importAvatarUpload.discardUnattached, {
        storageId: args.temporaryStorageId,
      });
      return null;
    } catch (error) {
      await Promise.allSettled([
        ...(storageId
          ? [
              ctx.runMutation(internal.importAvatarUpload.discardUnattached, {
                storageId,
              }),
            ]
          : []),
        ctx.runMutation(internal.importAvatarUpload.discardUnattached, {
          storageId: args.temporaryStorageId,
        }),
      ]);
      throw error;
    }
  },
});
