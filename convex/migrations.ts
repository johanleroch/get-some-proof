import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const defaultBatchSize = 100;
const maximumBatchSize = 500;

function fixedTimestamp(value: number) {
  const microseconds = Math.round(value * 1_000);
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(microseconds)
  ) {
    throw new ConvexError({
      code: "INVALID_LEGACY_PUBLIC_ORDER",
      message:
        "Legacy public order timestamps must be finite and non-negative.",
    });
  }
  return String(microseconds).padStart(16, "0");
}

/**
 * Legacy keys stay below live fractional keys, which begin at `V`. Their
 * fixed-width timestamp segments preserve the pre-migration published order,
 * while the encoded Convex id guarantees uniqueness without batch state.
 */
export function legacyPublicOrderKey(
  projection: Pick<
    Doc<"publicTestimonialProjections">,
    "_creationTime" | "_id" | "publishedAt"
  >,
) {
  const encodedId = [...String(projection._id)]
    .map((character) =>
      character.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"),
    )
    .join("");
  return `1${fixedTimestamp(projection.publishedAt)}${fixedTimestamp(projection._creationTime)}${encodedId}Z`;
}

/**
 * Phase two of the public Wall ordering migration.
 *
 * Deploy the schema with the optional field first, then call this internal
 * mutation repeatedly with the returned cursor until `isDone` is true. A
 * later release may make `publicOrderKey` required after every deployment has
 * completed the backfill.
 */
export const backfillPublicOrderKeys = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.union(v.null(), v.string()),
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? defaultBatchSize;
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > maximumBatchSize
    ) {
      throw new ConvexError({
        code: "INVALID_MIGRATION_BATCH_SIZE",
        message: `batchSize must be an integer from 1 to ${maximumBatchSize}.`,
      });
    }

    const page = await ctx.db
      .query("publicTestimonialProjections")
      .paginate({ cursor: args.cursor, numItems: batchSize });
    let updated = 0;
    for (const projection of page.page) {
      if (projection.publicOrderKey !== undefined) continue;
      await ctx.db.patch(projection._id, {
        publicOrderKey: legacyPublicOrderKey(projection),
      });
      updated += 1;
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      updated,
    };
  },
});
