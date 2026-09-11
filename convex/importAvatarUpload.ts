import { ConvexError, v, type Infer } from "convex/values";
import {
  action,
  mutation,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { hashSubmissionManagementToken } from "./domain/submission";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { importAvatarTarget as target } from "./domain/importAvatar";
import { imageAssetMetadata } from "./domain/imageAsset";
import { deleteImageAsset, registerImageAsset } from "./imageAssetRegistry";

const limiter = new RateLimiter(components.rateLimiter, {
  photo: { kind: "fixed window", rate: 30, period: HOUR },
});
function unavailable(): never {
  throw new ConvexError({
    code: "IMPORT_UNAVAILABLE",
    message: "This preview is no longer available. Read your wall again.",
  });
}
async function editable(ctx: MutationCtx, value: Infer<typeof target>) {
  if ("itemId" in value) {
    const item = await ctx.db.get(value.itemId);
    const job = item ? await ctx.db.get(item.jobId) : null;
    if (
      !item ||
      !job ||
      job.expiresAt <= Date.now() ||
      item.outcome ||
      item.videoStatus ||
      (item.sourceState && item.sourceState !== "new")
    )
      unavailable();
    const { principal } = await requireOrganizationPermission(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
    );
    return {
      kind: "owned" as const,
      item,
      job,
      principal,
      key: `owner:${principal.actorId}`,
    };
  }
  if (!/^[a-f0-9]{64}$/.test(value.token)) unavailable();
  const hash = await hashSubmissionManagementToken(value.token);
  const preview = await ctx.db
    .query("anonymousWallPreviews")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
    .unique();
  if (
    !preview ||
    preview.claimedBy ||
    preview.expiresAt <= Date.now() ||
    !Number.isSafeInteger(value.position) ||
    value.position < 0 ||
    value.position >= preview.items.length ||
    preview.items[value.position]!.unavailableReason
  )
    unavailable();
  return {
    kind: "anonymous" as const,
    preview,
    position: value.position,
    key: `preview:${preview._id}`,
  };
}

export const authorize = internalMutation({
  args: { target },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await editable(ctx, args.target);
    await limiter.limit(ctx, "photo", { key: access.key, throws: true });
    return null;
  },
});

export const attach = internalMutation({
  args: {
    target,
    storageId: v.union(v.null(), v.id("_storage")),
    metadata: v.optional(imageAssetMetadata),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await editable(ctx, args.target);
    const expiresAt =
      access.kind === "owned" ? access.job.expiresAt : access.preview.expiresAt;
    if (args.storageId) {
      if (!args.metadata) unavailable();
      if (!(await ctx.db.system.get("_storage", args.storageId))) unavailable();
      await registerImageAsset(
        ctx,
        args.storageId,
        args.metadata,
        "submitterPhoto",
        access.kind === "owned"
          ? { organizationId: access.job.organizationId }
          : {},
      );
      const uploadId = await ctx.db.insert("importAvatarUploads", {
        storageId: args.storageId,
        expiresAt,
      });
      await ctx.scheduler.runAfter(
        Math.max(0, expiresAt - Date.now()),
        internal.importAvatarUpload.expire,
        { uploadId },
      );
    }
    let previous;
    if (access.kind === "owned") {
      previous = access.item.identityCorrection?.avatarStorageId;
      await ctx.db.patch(access.item._id, {
        identityCorrection: {
          authorName:
            access.item.identityCorrection?.authorName ??
            access.item.authorName,
          tagline:
            access.item.identityCorrection?.tagline ??
            access.item.tagline ??
            "",
          editedBy: access.principal.actorId,
          editedAt: Date.now(),
          avatarStorageId: args.storageId,
        },
      });
    } else {
      const corrections = access.preview.identityCorrections ?? [];
      const old = corrections.find((c) => c.position === access.position);
      const item = access.preview.items[access.position]!;
      previous = old?.avatarStorageId;
      await ctx.db.patch(access.preview._id, {
        identityCorrections: [
          ...corrections.filter((c) => c.position !== access.position),
          {
            position: access.position,
            authorName: old?.authorName ?? item.authorName,
            tagline: old?.tagline ?? item.tagline ?? "",
            editedAt: Date.now(),
            avatarStorageId: args.storageId,
          },
        ],
      });
    }
    if (previous && previous !== args.storageId) {
      const old = await ctx.db
        .query("importAvatarUploads")
        .withIndex("by_storage_id", (q) => q.eq("storageId", previous))
        .unique();
      if (old) await ctx.db.delete(old._id);
      await deleteImageAsset(ctx, previous);
    }
    return null;
  },
});

export const upload = action({
  args: { target, bytes: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(internal.importAvatarUpload.authorize, {
      target: args.target,
    });
    return ctx.runAction(internal.importImageProcessing.uploadCorrection, args);
  },
});

export const discardUnattached = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db
      .query("importAvatarUploads")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
    const testimonial = await ctx.db
      .query("testimonials")
      .withIndex("by_avatar_storage_id", (q) =>
        q.eq("avatarStorageId", args.storageId),
      )
      .first();
    if (!upload && !testimonial) await deleteImageAsset(ctx, args.storageId);
    return null;
  },
});

export const remove = mutation({
  args: { target },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.importAvatarUpload.attach, {
      ...args,
      storageId: null,
    });
    return null;
  },
});

export const expire = internalMutation({
  args: { uploadId: v.id("importAvatarUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload) return null;
    if (upload.expiresAt > Date.now()) {
      await ctx.scheduler.runAfter(
        upload.expiresAt - Date.now(),
        internal.importAvatarUpload.expire,
        args,
      );
      return null;
    }
    const testimonial = await ctx.db
      .query("testimonials")
      .withIndex("by_avatar_storage_id", (q) =>
        q.eq("avatarStorageId", upload.storageId),
      )
      .first();
    if (!testimonial) await deleteImageAsset(ctx, upload.storageId);
    await ctx.db.delete(upload._id);
    return null;
  },
});
