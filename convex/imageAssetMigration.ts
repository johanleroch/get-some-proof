"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import {
  normalizeStoredImage,
  StoredImageNormalizationError,
} from "./lib/normalizeImage";

export const process = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    retryFailed: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const limit = args.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new ConvexError({
        code: "INVALID_MIGRATION_BATCH_SIZE",
        message: "limit must be an integer from 1 to 20.",
      });
    const jobs = await ctx.runQuery(internal.imageAssetMigrationState.next, {
      limit,
      retryFailed: args.retryFailed ?? false,
    });
    const results: Array<Record<string, unknown>> = [];
    for (const job of jobs) {
      const source = await ctx.storage.get(job.storageId as Id<"_storage">);
      if (!source) {
        if (!args.dryRun)
          await ctx.runMutation(internal.imageAssetMigrationState.fail, {
            diagnostic: "SOURCE_MISSING",
            jobId: job._id,
          });
        results.push({
          jobId: job._id,
          status: "failed",
          diagnostic: "SOURCE_MISSING",
        });
        continue;
      }
      try {
        const normalized = await normalizeStoredImage(
          source,
          job.kind,
          "migration",
        );
        if (args.dryRun) {
          results.push({
            jobId: job._id,
            status: "dry-run",
            beforeBytes: source.size,
            afterBytes: normalized.metadata.size,
          });
          continue;
        }
        const replacementStorageId = await ctx.storage.store(
          new Blob([normalized.bytes], { type: "image/webp" }),
        );
        const status = await ctx.runMutation(
          internal.imageAssetMigrationState.commit,
          {
            jobId: job._id,
            metadata: normalized.metadata,
            replacementStorageId,
          },
        );
        results.push({ jobId: job._id, status });
      } catch (error) {
        const diagnostic =
          error instanceof StoredImageNormalizationError
            ? error.diagnostic
            : "MIGRATION_FAILED";
        if (!args.dryRun)
          await ctx.runMutation(internal.imageAssetMigrationState.fail, {
            diagnostic,
            jobId: job._id,
          });
        results.push({ jobId: job._id, status: "failed", diagnostic });
      }
    }
    return { dryRun: args.dryRun ?? false, processed: results.length, results };
  },
});
