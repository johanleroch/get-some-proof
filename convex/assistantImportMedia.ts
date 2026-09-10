"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  downloadPublicPortrait,
  MediaCopyError,
} from "../src/lib/testimonial-import/public-media";

export const copyPortrait = internalAction({
  args: {
    itemId: v.id("testimonialImportItems"),
    testimonialId: v.id("testimonials"),
    attempt: v.number(),
    copyAttempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sourceArgs = {
      itemId: args.itemId,
      testimonialId: args.testimonialId,
      attempt: args.attempt,
    };
    const source = await ctx.runQuery(
      internal.testimonialImportAvatar.source,
      sourceArgs,
    );
    if (!source || source.provider !== "assistant") return null;
    let storageId: Id<"_storage"> | undefined;
    try {
      storageId = await ctx.storage.store(
        await downloadPublicPortrait(source.url),
      );
    } catch (error) {
      const copyAttempt = args.copyAttempt ?? 1;
      if (
        error instanceof MediaCopyError &&
        error.transient &&
        copyAttempt < 3
      ) {
        await ctx.scheduler.runAfter(
          copyAttempt * 2_000,
          internal.assistantImportMedia.copyPortrait,
          { ...sourceArgs, copyAttempt: copyAttempt + 1 },
        );
        return null;
      }
      await ctx.runMutation(internal.testimonialImportAvatar.finish, {
        ...sourceArgs,
        sourceUrl: source.url,
      });
      return null;
    }
    await ctx.runMutation(internal.testimonialImportAvatar.finish, {
      ...sourceArgs,
      sourceUrl: source.url,
      storageId,
    });
    return null;
  },
});
