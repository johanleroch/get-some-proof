import { ConvexError, v } from "convex/values";
import { Migrations } from "@convex-dev/migrations";

import type { Doc } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import schema from "./schema";
import type { ImageAssetKind } from "../src/lib/image-assets";

const defaultBatchSize = 100;
const maximumBatchSize = 500;

const statefulMigrations = new Migrations(components.migrations, {
  defaultBatchSize: 25,
  internalMutation,
  schema,
});

type LegacyImageReference = {
  referenceTable:
    | "userProfiles"
    | "organizations"
    | "testimonialAvatar"
    | "testimonialPoster"
    | "testimonialImages";
  referenceId: string;
  storageId: Doc<"imageAssetMigrationJobs">["storageId"];
  kind: ImageAssetKind;
  organizationId?: Doc<"organizations">["_id"];
  ownerUserId?: string;
  testimonialId?: Doc<"testimonials">["_id"];
  testimonialImageId?: Doc<"testimonialImages">["_id"];
};

async function queueLegacyImage(
  ctx: MutationCtx,
  reference: LegacyImageReference,
) {
  const registered = await ctx.db
    .query("imageAssets")
    .withIndex("by_storage_id", (q) => q.eq("storageId", reference.storageId))
    .first();
  if (registered) return;
  const existing = await ctx.db
    .query("imageAssetMigrationJobs")
    .withIndex("by_reference", (q) =>
      q
        .eq("referenceTable", reference.referenceTable)
        .eq("referenceId", reference.referenceId),
    )
    .unique();
  if (existing) return;
  const now = Date.now();
  await ctx.db.insert("imageAssetMigrationJobs", {
    ...reference,
    attempts: 0,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  });
}

export const queueLegacyOwnerPhotos = statefulMigrations.define({
  table: "userProfiles",
  migrateOne: async (ctx, profile) => {
    if (!profile.avatarStorageId) return;
    await queueLegacyImage(ctx, {
      referenceTable: "userProfiles",
      referenceId: String(profile._id),
      storageId: profile.avatarStorageId,
      kind: "ownerPhoto",
      ownerUserId: profile.userId,
    });
  },
});

export const queueLegacyBrandLogos = statefulMigrations.define({
  table: "organizations",
  migrateOne: async (ctx, organization) => {
    if (!organization.logoStorageId) return;
    await queueLegacyImage(ctx, {
      referenceTable: "organizations",
      referenceId: String(organization._id),
      storageId: organization.logoStorageId,
      kind: "brandLogo",
      organizationId: organization._id,
    });
  },
});

export const queueLegacyTestimonialImages = statefulMigrations.define({
  table: "testimonialImages",
  migrateOne: async (ctx, image) => {
    if (!image.storageId) return;
    await queueLegacyImage(ctx, {
      referenceTable: "testimonialImages",
      referenceId: String(image._id),
      storageId: image.storageId,
      kind: "testimonialImage",
      organizationId: image.organizationId,
      testimonialId: image.testimonialId ?? image.managementTestimonialId,
      testimonialImageId: image._id,
    });
  },
});

export const queueLegacyTestimonialAvatars = statefulMigrations.define({
  table: "testimonials",
  migrateOne: async (ctx, testimonial) => {
    if (!testimonial.avatarStorageId) return;
    await queueLegacyImage(ctx, {
      referenceTable: "testimonialAvatar",
      referenceId: String(testimonial._id),
      storageId: testimonial.avatarStorageId,
      kind: "submitterPhoto",
      organizationId: testimonial.organizationId,
      testimonialId: testimonial._id,
    });
  },
});

export const queueLegacyTestimonialPosters = statefulMigrations.define({
  table: "testimonials",
  migrateOne: async (ctx, testimonial) => {
    if (!testimonial.posterStorageId) return;
    await queueLegacyImage(ctx, {
      referenceTable: "testimonialPoster",
      referenceId: String(testimonial._id),
      storageId: testimonial.posterStorageId,
      kind: "videoThumbnail",
      organizationId: testimonial.organizationId,
      testimonialId: testimonial._id,
    });
  },
});

export const runImageAssetInventory = statefulMigrations.runner([
  internal.migrations.queueLegacyOwnerPhotos,
  internal.migrations.queueLegacyBrandLogos,
  internal.migrations.queueLegacyTestimonialImages,
  internal.migrations.queueLegacyTestimonialAvatars,
  internal.migrations.queueLegacyTestimonialPosters,
]);

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
