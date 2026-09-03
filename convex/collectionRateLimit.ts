import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { hashSubmissionManagementToken } from "./domain/submission";

const collectionWindowMs = 60 * 60 * 1_000;
const perBrowserWindow = 5;
const perBrandWindow = 100;
const emergencyGlobalWindow = 1_000;

async function consumeBucket(
  ctx: MutationCtx,
  resourceKey: string,
  limit: number,
  windowStartedAt: number,
) {
  const bucket = await ctx.db
    .query("publicReadRateLimitBuckets")
    .withIndex("by_resource_window", (index) =>
      index
        .eq("resourceKey", resourceKey)
        .eq("windowStartedAt", windowStartedAt),
    )
    .unique();
  if ((bucket?.count ?? 0) >= limit) {
    throw new ConvexError({
      code: "COLLECTION_RATE_LIMITED",
      message: "Collection is temporarily unavailable. Try again later.",
    });
  }
  if (bucket) {
    await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
  } else {
    await ctx.db.insert("publicReadRateLimitBuckets", {
      count: 1,
      expiresAt: windowStartedAt + collectionWindowMs * 2,
      resourceKey,
      windowStartedAt,
    });
  }
}

export async function consumeCollectionRequest(
  ctx: MutationCtx,
  input: {
    clientSubmissionId: string;
    organizationId: Id<"organizations">;
    submissionType: "text" | "video";
  },
) {
  const windowStartedAt =
    Math.floor(Date.now() / collectionWindowMs) * collectionWindowMs;
  const browserKey = await hashSubmissionManagementToken(
    `${String(input.organizationId)}:${input.clientSubmissionId}`,
  );
  await consumeBucket(
    ctx,
    `collection:browser:${browserKey}`,
    perBrowserWindow,
    windowStartedAt,
  );
  await consumeBucket(
    ctx,
    `collection:brand:${String(input.organizationId)}:${input.submissionType}`,
    perBrandWindow,
    windowStartedAt,
  );
  await consumeBucket(
    ctx,
    `collection:global:${input.submissionType}`,
    emergencyGlobalWindow,
    windowStartedAt,
  );
}

export const recordPublicCollectionRequest = internalMutation({
  args: {
    clientSubmissionId: v.string(),
    publicSlug: v.string(),
    submissionType: v.union(v.literal("text"), v.literal("video")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", args.publicSlug.trim().toLowerCase()),
      )
      .unique();
    if (!organization) return null;
    await consumeCollectionRequest(ctx, {
      clientSubmissionId: args.clientSubmissionId,
      organizationId: organization._id,
      submissionType: args.submissionType,
    });
    return null;
  },
});
