"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { directImageTarget } from "./domain/directImageUpload";
import { imageAssetMetadata } from "./domain/imageAsset";
import {
  acceptedImageInputTypes,
  maximumImageInputBytes,
} from "../src/lib/image-assets";
import {
  normalizeStoredImage,
  StoredImageNormalizationError,
} from "./lib/normalizeImage";
import type { ImageAssetMetadataValue } from "./domain/imageAsset";

type DirectImageProcessingResult = {
  metadata: ImageAssetMetadataValue;
  storageId: Id<"_storage">;
  verificationId: Id<"directImageVerifications">;
};

export const processDirectUpload = action({
  args: {
    browserMetadata: imageAssetMetadata,
    target: directImageTarget,
    temporaryStorageId: v.id("_storage"),
  },
  returns: v.object({
    metadata: imageAssetMetadata,
    storageId: v.id("_storage"),
    verificationId: v.id("directImageVerifications"),
  }),
  handler: async (ctx, args): Promise<DirectImageProcessingResult> => {
    await ctx.runMutation(internal.imageAssetProcessingState.authorizeCleanup, {
      target: args.target,
    });
    try {
      await ctx.runMutation(
        internal.imageAssetProcessingState.authorizeTemporary,
        {
          target: args.target,
          temporaryStorageId: args.temporaryStorageId,
        },
      );
    } catch (error) {
      await Promise.allSettled([
        ctx.runMutation(
          internal.imageAssetProcessingState.discardUnattachedTemporary,
          {
            target: args.target,
            temporaryStorageId: args.temporaryStorageId,
          },
        ),
      ]);
      throw error;
    }
    let storageId: Id<"_storage"> | undefined;
    try {
      if (
        args.browserMetadata.kind !== args.target.kind ||
        args.browserMetadata.source !== "direct" ||
        !acceptedImageInputTypes.includes(
          args.browserMetadata
            .originalContentType as (typeof acceptedImageInputTypes)[number],
        ) ||
        args.browserMetadata.originalSize <= 0 ||
        args.browserMetadata.originalSize > maximumImageInputBytes
      )
        throw new ConvexError({ code: "INVALID_IMAGE_METADATA" });
      const input = await ctx.storage.get(args.temporaryStorageId);
      if (!input) throw new ConvexError({ code: "IMAGE_UPLOAD_UNAVAILABLE" });
      let normalized;
      try {
        normalized = await normalizeStoredImage(
          input,
          args.target.kind,
          "direct",
        );
      } catch (error) {
        throw new ConvexError({
          code:
            error instanceof StoredImageNormalizationError
              ? error.diagnostic
              : "IMAGE_OPTIMIZATION_FAILED",
          message: "The image could not be verified. Upload another image.",
        });
      }
      normalized.metadata.originalContentType =
        args.browserMetadata.originalContentType;
      normalized.metadata.originalSize = args.browserMetadata.originalSize;
      storageId = await ctx.storage.store(
        new Blob([normalized.bytes], { type: "image/webp" }),
      );
      const verificationId: Id<"directImageVerifications"> =
        await ctx.runMutation(internal.imageAssetProcessingState.record, {
          metadata: normalized.metadata,
          storageId,
          target: args.target,
          temporaryStorageId: args.temporaryStorageId,
        });
      return { metadata: normalized.metadata, storageId, verificationId };
    } catch (error) {
      await Promise.allSettled([
        ...(storageId
          ? [
              ctx.runMutation(
                internal.imageAssetProcessingState.discardUnrecorded,
                { storageId },
              ),
            ]
          : []),
        ctx.runMutation(
          internal.imageAssetProcessingState.discardUnattachedTemporary,
          {
            target: args.target,
            temporaryStorageId: args.temporaryStorageId,
          },
        ),
      ]);
      throw error;
    }
  },
});
