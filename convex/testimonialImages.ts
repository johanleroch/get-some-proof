import { isProjectOpen } from "./projectActivity";
import { consumeAdmission } from "./collectionAdmission";
import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import {
  imageValueValidator,
  maximumTestimonialImages,
  maximumTestimonialImageBytes,
  testimonialImageMimeTypes,
} from "./domain/testimonialImage";
import { ConvexError, v } from "convex/values";
import { internal, components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { hashSubmissionManagementToken } from "./domain/submission";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import { imageAssetMetadata } from "./domain/imageAsset";
import {
  attachImageAssetToTestimonial,
  deleteImageAsset,
  registerImageAsset,
} from "./imageAssetRegistry";
import { scheduleOrphanedStorageCleanup } from "./storageCleanup";

const hour = HOUR;
const rateLimiter = new RateLimiter(components.rateLimiter, {
  testimonialImageUpload: { kind: "fixed window", rate: 30, period: HOUR },
});

const uploadIdentity = {
  clientSubmissionId: v.string(),
  publicSlug: v.string(),
  token: v.optional(v.string()),
};
function unavailable(): never {
  throw new ConvexError({
    code: "TESTIMONIAL_IMAGE_UNAVAILABLE",
    message: "Image unavailable. Upload it again.",
  });
}

export async function resolveUploadContext(
  ctx: MutationCtx,
  args: { clientSubmissionId: string; publicSlug: string; token?: string },
  kind: "image" | "avatar" = "image",
) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.clientSubmissionId)) unavailable();
  const brand = await ctx.db
    .query("organizations")
    .withIndex("by_public_slug", (q) => q.eq("publicSlug", args.publicSlug))
    .unique();
  if (!brand || !(await isProjectOpen(ctx, brand))) unavailable();
  let testimonialId: Id<"testimonials"> | undefined;
  if (args.token !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(args.token)) unavailable();
    const hash = await hashSubmissionManagementToken(args.token);
    const testimonial = await ctx.db
      .query("testimonials")
      .withIndex("by_management_token_hash", (q) =>
        q.eq("managementTokenHash", hash),
      )
      .unique();
    if (
      !testimonial ||
      testimonial.organizationId !== brand._id ||
      (kind === "image" && testimonial.submissionType !== "text") ||
      testimonial.moderationStatus === "spam" ||
      (testimonial.managementTokenExpiresAt !== undefined &&
        testimonial.managementTokenExpiresAt <= Date.now())
    )
      unavailable();
    const consent = await ctx.db
      .query("publicationConsents")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!consent) unavailable();
    testimonialId = testimonial._id;
  }
  return { brand, testimonialId };
}

export const generateUploadUrl = mutation({
  args: { ...uploadIdentity, admissionToken: v.optional(v.string()) },
  returns: v.object({
    imageId: v.id("testimonialImages"),
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const { brand, testimonialId } = await resolveUploadContext(ctx, args);
    if (!testimonialId)
      await consumeAdmission(
        ctx,
        {
          organizationId: brand._id,
          clientSubmissionId: args.clientSubmissionId,
          token: args.admissionToken,
        },
        "image",
      );
    const limit = await rateLimiter.limit(ctx, "testimonialImageUpload", {
      key: String(brand._id),
    });
    if (!limit.ok)
      throw new ConvexError({
        code: "IMAGE_UPLOAD_LIMIT",
        message: "Image uploads are temporarily unavailable. Try again later.",
      });
    const imageId = await ctx.db.insert("testimonialImages", {
      organizationId: brand._id,
      clientSubmissionId: args.clientSubmissionId,
      managementTestimonialId: testimonialId,
      createdAt: Date.now(),
      expiresAt: Date.now() + hour,
    });
    await ctx.scheduler.runAfter(
      3 * hour,
      internal.testimonialImages.expireUpload,
      { imageId },
    );
    return { imageId, uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const registerUpload = mutation({
  args: {
    ...uploadIdentity,
    imageId: v.id("testimonialImages"),
    storageId: v.id("_storage"),
    metadata: imageAssetMetadata,
  },
  returns: imageValueValidator,
  handler: async (ctx, args) => {
    const { brand, testimonialId } = await resolveUploadContext(ctx, args);
    const image = await ctx.db.get(args.imageId);
    if (
      !image ||
      image.organizationId !== brand._id ||
      image.clientSubmissionId !== args.clientSubmissionId ||
      image.managementTestimonialId !== testimonialId ||
      image.testimonialId ||
      image.expiresAt <= Date.now()
    )
      unavailable();
    if (image.storageId === args.storageId)
      return {
        id: image._id,
        url: (await ctx.storage.getUrl(args.storageId))!,
      };
    if (image.storageId) unavailable();
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !metadata ||
      !testimonialImageMimeTypes.includes(metadata.contentType ?? "") ||
      metadata.size > maximumTestimonialImageBytes ||
      metadata.size === 0 ||
      metadata._creationTime < image.createdAt
    )
      throw new ConvexError({
        code: "INVALID_TESTIMONIAL_IMAGE",
        message: "The image could not be optimized. Choose another image.",
      });
    await validateExclusiveStoredImage(ctx, args.storageId, {
      kind: "testimonial",
      imageKind: "testimonialImage",
    });
    const reservation = await ctx.db
      .query("submissionAvatarUploads")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    if (reservation) unavailable();
    await registerImageAsset(
      ctx,
      args.storageId,
      args.metadata,
      "testimonialImage",
      {
        organizationId: brand._id,
        testimonialId,
        testimonialImageId: image._id,
      },
    );
    await ctx.db.patch(image._id, { storageId: args.storageId });
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) unavailable();
    return { id: image._id, url };
  },
});

export async function resolveTestimonialImages(
  ctx: QueryCtx,
  ids?: Id<"testimonialImages">[],
) {
  const images = await Promise.all(
    (ids ?? []).map(async (id) => {
      const image = await ctx.db.get(id);
      const url = image?.storageId
        ? await ctx.storage.getUrl(image.storageId)
        : null;
      return url ? { id, url } : null;
    }),
  );
  return images.filter((image) => image !== null);
}

export async function setTestimonialImages(
  ctx: MutationCtx,
  testimonial: Doc<"testimonials">,
  ids: Id<"testimonialImages">[],
  clientSubmissionId?: string,
) {
  if (
    ids.length > maximumTestimonialImages ||
    new Set(ids).size !== ids.length ||
    testimonial.submissionType !== "text"
  )
    unavailable();
  const desiredImages = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const digests = await Promise.all(
    desiredImages.map((image) =>
      image?.storageId
        ? ctx.db.system.get("_storage", image.storageId)
        : Promise.resolve(null),
    ),
  );
  const seenDigests = new Set<string>();
  for (const stored of digests) {
    if (!stored?.sha256) continue;
    if (seenDigests.has(stored.sha256))
      throw new ConvexError({
        code: "DUPLICATE_TESTIMONIAL_IMAGE",
        message: "Remove the duplicate image before submitting.",
      });
    seenDigests.add(stored.sha256);
  }
  await Promise.all(
    ids.map(async (id, index) => {
      const image = desiredImages[index];
      if (
        !image ||
        !image.storageId ||
        image.organizationId !== testimonial.organizationId
      )
        unavailable();
      if (image.testimonialId !== testimonial._id) {
        if (image.testimonialId || image.expiresAt <= Date.now()) unavailable();
        if (
          clientSubmissionId !== undefined
            ? image.clientSubmissionId !== clientSubmissionId ||
              image.managementTestimonialId !== undefined
            : image.managementTestimonialId !== testimonial._id
        )
          unavailable();
        await ctx.db.patch(id, { testimonialId: testimonial._id });
        await attachImageAssetToTestimonial(
          ctx,
          image.storageId,
          testimonial._id,
        );
      }
    }),
  );
  const keep = new Set(ids);
  await Promise.all(
    (testimonial.imageIds ?? [])
      .filter((id) => !keep.has(id))
      .map((id) => deleteImage(ctx, id)),
  );
  await ctx.db.patch(testimonial._id, { imageIds: ids });
}

async function deleteImage(
  ctx: MutationCtx,
  id: Id<"testimonialImages">,
  mediaAlreadyHandled = false,
) {
  const image = await ctx.db.get(id);
  if (!image) return;
  if (!mediaAlreadyHandled && image.storageId)
    await deleteImageAsset(ctx, image.storageId);
  await ctx.db.delete(id);
}
export async function deleteTestimonialImages(
  ctx: MutationCtx,
  testimonialId: Id<"testimonials">,
  mediaAlreadyHandled = false,
) {
  const images = await ctx.db
    .query("testimonialImages")
    .withIndex("by_testimonial", (q) => q.eq("testimonialId", testimonialId))
    .take(4);
  await Promise.all(
    images.map((image) => deleteImage(ctx, image._id, mediaAlreadyHandled)),
  );
}
export const expireUpload = internalMutation({
  args: { imageId: v.id("testimonialImages") },
  returns: v.null(),
  handler: async (ctx, { imageId }) => {
    const image = await ctx.db.get(imageId);
    if (image && !image.testimonialId && image.expiresAt <= Date.now())
      await deleteImage(ctx, imageId);
    await scheduleOrphanedStorageCleanup(ctx);
    return null;
  },
});

export async function clearTestimonialImageLimit(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  await rateLimiter.reset(ctx, "testimonialImageUpload", {
    key: String(organizationId),
  });
}
