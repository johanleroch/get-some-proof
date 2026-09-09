"use node";

import { ConvexError, v } from "convex/values";
import { randomBytes, createHash } from "node:crypto";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  previewWall,
  WallSourceError,
} from "../src/lib/testimonial-import/source";

export const previewAnonymous = action({
  args: {
    url: v.string(),
    channel: v.optional(v.union(v.literal("public-web"), v.literal("chatgpt"))),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args): Promise<{ token: string }> => {
    const acquisitionFlowId = await ctx.runMutation(
      internal.anonymousWallImports.authorize,
      { channel: args.channel },
    );
    try {
      const source = await previewWall(args.url);
      const token = randomBytes(32).toString("hex");
      await ctx.runMutation(internal.anonymousWallImports.store, {
        ...source,
        acquisitionFlowId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
      });
      return { token };
    } catch (error) {
      if (error instanceof WallSourceError)
        throw new ConvexError({ code: error.code, message: error.message });
      throw error;
    }
  },
});

export const preview = action({
  args: { organizationId: v.id("organizations"), url: v.string() },
  returns: v.object({ jobId: v.id("testimonialImportJobs") }),
  handler: async (
    ctx,
    args,
  ): Promise<{ jobId: Id<"testimonialImportJobs"> }> => {
    await ctx.runMutation(internal.testimonialImports.authorizePreview, {
      organizationId: args.organizationId,
    });
    try {
      const source = await previewWall(args.url);
      return await ctx.runMutation(internal.testimonialImports.storePreview, {
        organizationId: args.organizationId,
        ...source,
      });
    } catch (error) {
      if (error instanceof WallSourceError)
        throw new ConvexError({ code: error.code, message: error.message });
      throw error;
    }
  },
});
