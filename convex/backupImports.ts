import { normalizeRichText } from "./domain/testimonialRichText";
import { maximumTestimonialImages } from "./domain/testimonialImage";
import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { wallCandidate } from "./domain/testimonialImport";
import { directImageTarget } from "./domain/directImageUpload";
import { confirmOwnedImport } from "./testimonialImports";
import { consumeDirectImage } from "./imageAssetProcessingState";
import { registerImageAsset } from "./imageAssetRegistry";

export const restore = mutation({
  args: {
    organizationId: v.id("organizations"),
    sourceProject: v.string(),
    items: v.array(wallCandidate),
  },
  returns: v.object({
    jobId: v.id("testimonialImportJobs"),
    items: v.array(
      v.object({
        sourceId: v.string(),
        itemId: v.id("testimonialImportItems"),
        testimonialId: v.optional(v.id("testimonials")),
        skipped: v.boolean(),
        uploadJobId: v.id("testimonialImportJobs"),
        videoNeeded: v.boolean(),
        videoRequestId: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    if (
      !args.sourceProject ||
      args.sourceProject.length > 128 ||
      !args.items.length ||
      args.items.length > 100 ||
      JSON.stringify(args.items).length > 500000
    )
      throw new ConvexError("Select between 1 and 100 testimonials.");
    for (const item of args.items) {
      if (
        !item.sourceId ||
        item.sourceId.length > 128 ||
        !item.authorName.trim() ||
        item.authorName.length > 160 ||
        item.text.length > 20000 ||
        item.avatarUrl ||
        item.videoUrl ||
        (item.rating !== undefined &&
          (!Number.isInteger(item.rating) ||
            item.rating < 1 ||
            item.rating > 5))
      )
        throw new ConvexError("Invalid backup testimonial.");
    }
    const now = Date.now();
    const jobId = await ctx.db.insert("testimonialImportJobs", {
      organizationId: args.organizationId,
      provider: "backup",
      sourceUrl: `https://getsomeproof.com/backups/${encodeURIComponent(args.sourceProject)}`,
      createdBy: principal.actorId,
      createdAt: now,
      expiresAt: now + 86400000,
      itemCount: args.items.length,
    });
    const ids = [];
    for (const [position, item] of args.items.entries())
      ids.push(
        await ctx.db.insert("testimonialImportItems", {
          ...item,
          richText: normalizeRichText(item.richText, item.text),
          organizationId: args.organizationId,
          jobId,
          position,
        }),
      );
    await confirmOwnedImport(ctx, { jobId, itemIds: ids });
    const items = await Promise.all(
      ids.map(async (itemId) => {
        const item = (await ctx.db.get(itemId))!;
        const testimonial = item.testimonialId
          ? await ctx.db.get(item.testimonialId)
          : null;
        const previous = testimonial
          ? await ctx.db
              .query("testimonialImportItems")
              .withIndex("by_testimonialId", (q) =>
                q.eq("testimonialId", testimonial._id),
              )
              .take(100)
          : [];
        const canonical =
          previous.find(
            (candidate) =>
              candidate.jobId === testimonial?.importJobId &&
              candidate.outcome !== "skipped" &&
              candidate.outcome !== "changed",
          ) ?? item;
        const uploads =
          canonical.type === "video"
            ? await ctx.db
                .query("assistantImportUploads")
                .withIndex("by_itemId_and_requestId", (q) =>
                  q.eq("itemId", canonical._id),
                )
                .take(100)
            : [];
        const activeUpload = uploads.find(
          (upload) => upload.status !== "failed" && upload.expiresAt > now,
        );
        return {
          videoRequestId: activeUpload?.requestId,
          sourceId: item.sourceId,
          itemId: canonical._id,
          uploadJobId: canonical.jobId,
          testimonialId: item.testimonialId,
          skipped:
            item.outcome === "changed" ||
            testimonial?.moderationStatus !== "pending",
          videoNeeded:
            canonical.type === "video" &&
            (canonical.videoStatus === "failed" || !!activeUpload),
        };
      }),
    );
    return { jobId, items };
  },
});
async function owned(ctx: MutationCtx, testimonialId: Id<"testimonials">) {
  const testimonial = await ctx.db.get(testimonialId);
  if (
    !testimonial ||
    testimonial.importOrigin?.provider !== "backup" ||
    testimonial.moderationStatus !== "pending"
  )
    throw new ConvexError("Backup testimonial unavailable.");
  await requireOrganizationPermission(
    ctx,
    { organizationId: testimonial.organizationId },
    "ownership:manage",
  );
  return testimonial;
}
export const imageUpload = mutation({
  args: {
    testimonialId: v.id("testimonials"),
    role: v.union(
      v.literal("avatar"),
      v.literal("thumbnail"),
      v.literal("image"),
    ),
    sourcePath: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({ uploadUrl: v.string(), target: directImageTarget }),
  ),
  handler: async (ctx, args) => {
    const t = await owned(ctx, args.testimonialId);
    if (args.sourcePath.length > 256)
      throw new ConvexError("Invalid media path.");
    const now = Date.now();
    if (args.role === "avatar") {
      if (t.avatarStorageId) return null;
      const reservationId = await ctx.db.insert("submissionAvatarUploads", {
        organizationId: t.organizationId,
        clientSubmissionId: `backup:${t._id}`,
        uploadAttempts: 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 3600000,
      });
      return {
        uploadUrl: await ctx.storage.generateUploadUrl(),
        target: { kind: "submitterPhoto" as const, reservationId },
      };
    }
    if (args.role === "thumbnail") {
      if (t.posterStorageId) return null;
      return {
        uploadUrl: await ctx.storage.generateUploadUrl(),
        target: {
          kind: "videoThumbnail" as const,
          organizationId: t.organizationId,
          testimonialId: t._id,
        },
      };
    }
    const existing = await ctx.db
      .query("testimonialImages")
      .withIndex("by_testimonial", (q) => q.eq("testimonialId", t._id))
      .take(10);
    if (
      existing.some(
        (image) =>
          image.clientSubmissionId === `backup:${args.sourcePath}` &&
          image.storageId,
      )
    )
      return null;
    if (
      t.submissionType !== "text" ||
      (t.imageIds?.length ?? 0) >= maximumTestimonialImages
    )
      throw new ConvexError("Too many testimonial images.");
    const imageId = await ctx.db.insert("testimonialImages", {
      organizationId: t.organizationId,
      clientSubmissionId: `backup:${args.sourcePath}`,
      testimonialId: t._id,
      createdAt: now,
      expiresAt: now + 3600000,
    });
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      target: { kind: "testimonialImage" as const, imageId },
    };
  },
});
export const attachImage = mutation({
  args: {
    testimonialId: v.id("testimonials"),
    target: directImageTarget,
    verificationId: v.id("directImageVerifications"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const t = await owned(ctx, args.testimonialId);
    const target = args.target;
    if (target.kind === "submitterPhoto") {
      const reservation = await ctx.db.get(target.reservationId);
      if (
        reservation?.organizationId !== t.organizationId ||
        reservation.clientSubmissionId !== `backup:${t._id}` ||
        t.avatarStorageId
      )
        throw new ConvexError("Image unavailable.");
    } else if (target.kind === "testimonialImage") {
      const image = await ctx.db.get(target.imageId);
      if (
        image?.testimonialId !== t._id ||
        image.organizationId !== t.organizationId ||
        (t.imageIds?.length ?? 0) >= maximumTestimonialImages
      )
        throw new ConvexError("Image unavailable.");
    } else if (
      target.kind !== "videoThumbnail" ||
      target.testimonialId !== t._id ||
      target.organizationId !== t.organizationId ||
      t.posterStorageId
    )
      throw new ConvexError("Image unavailable.");
    const image = await consumeDirectImage(ctx, args.verificationId, target);
    await registerImageAsset(
      ctx,
      image.storageId,
      image.metadata,
      target.kind,
      {
        organizationId: t.organizationId,
        testimonialId: t._id,
        ...(target.kind === "testimonialImage"
          ? { testimonialImageId: target.imageId }
          : {}),
      },
    );
    if (target.kind === "submitterPhoto") {
      await ctx.db.patch(t._id, { avatarStorageId: image.storageId });
      await ctx.db.patch(target.reservationId, { storageId: image.storageId });
    } else if (target.kind === "videoThumbnail")
      await ctx.db.patch(t._id, { posterStorageId: image.storageId });
    else {
      await ctx.db.patch(target.imageId, { storageId: image.storageId });
      await ctx.db.patch(t._id, {
        imageIds: [...(t.imageIds ?? []), target.imageId],
      });
    }
    return null;
  },
});
