import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { ConvexError, v } from "convex/values";
import { requireOrganizationPermissionForPrincipal } from "./security/organizationAccess";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  downloadImportAvatar,
  ImportAvatarError,
} from "../src/lib/testimonial-import/avatar";
import { importProvider } from "./domain/testimonialImport";
import { upsertPublicProjection } from "./publicProjection";
import { scheduleOrphanedStorageCleanup } from "./storageCleanup";

export async function retryOwnedImportAvatar(
  ctx: MutationCtx,
  itemId: Id<"testimonialImportItems">,
  principal: Principal,
  jobId?: Id<"testimonialImportJobs">,
) {
  const item = await ctx.db.get(itemId);
  if (!item || (jobId && item.jobId !== jobId))
    throw new ConvexError({ code: "IMPORT_UNAVAILABLE" });
  await requireOrganizationPermissionForPrincipal(
    ctx,
    { organizationId: item.organizationId },
    "ownership:manage",
    principal,
  );
  const job = await ctx.db.get(item.jobId);
  if (!job) throw new ConvexError({ code: "IMPORT_UNAVAILABLE" });
  if (job.provider === "assistant") {
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      item.organizationId,
    );
    if (
      entitlement.effectivePlan !== "premium" ||
      entitlement.state === "past_due"
    )
      throw new ConvexError("Pro is required to retry an imported photo.");
  }
  const testimonial = item.testimonialId
    ? await ctx.db.get(item.testimonialId)
    : null;
  if (
    !testimonial ||
    item.avatarStatus !== "failed" ||
    !item.avatarUrl ||
    testimonial.avatarStorageId
  )
    throw new ConvexError({ code: "IMPORT_UNAVAILABLE" });
  await ctx.db.patch(item._id, { avatarStatus: undefined });
  await queueImportedAvatar(
    ctx,
    { ...item, avatarStatus: undefined },
    testimonial._id,
  );
  return null;
}

export const retry = mutation({
  args: { itemId: v.id("testimonialImportItems") },
  returns: v.null(),
  handler: async (ctx, args) =>
    retryOwnedImportAvatar(
      ctx,
      args.itemId,
      await requireVerifiedPrincipal(ctx),
    ),
});

export const progress = query({
  args: { jobId: v.string() },
  returns: v.array(
    v.object({
      itemId: v.id("testimonialImportItems"),
      diagnostic: v.optional(v.string()),
      attempt: v.optional(v.number()),
      authorName: v.string(),
      status: v.union(
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("testimonialImportJobs", args.jobId);
    const job = id ? await ctx.db.get(id) : null;
    if (!job) return [];
    await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
      await requireVerifiedPrincipal(ctx),
    );
    const items = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (q) => q.eq("jobId", job._id))
      .take(500);
    return items.flatMap((item) =>
      item.avatarStatus
        ? [
            {
              itemId: item._id,
              diagnostic: item.avatarDiagnostic,
              attempt: item.avatarAttempt,
              authorName:
                item.identityCorrection?.authorName ?? item.authorName,
              status: item.avatarStatus,
            },
          ]
        : [],
    );
  },
});

export async function queueImportedAvatar(
  ctx: MutationCtx,
  item: Doc<"testimonialImportItems">,
  testimonialId: Id<"testimonials">,
) {
  if (
    item.identityCorrection?.avatarStorageId !== undefined ||
    !item.avatarUrl ||
    item.avatarStatus
  )
    return;
  const attempt = (item.avatarAttempt ?? 0) + 1;
  await ctx.db.patch(item._id, {
    avatarStatus: "processing",
    avatarDiagnostic: undefined,
    avatarAttempt: attempt,
  });
  await scheduleOrphanedStorageCleanup(ctx);
  await ctx.scheduler.runAfter(0, internal.testimonialImportAvatar.copy, {
    itemId: item._id,
    testimonialId,
    attempt,
  });
  await ctx.scheduler.runAfter(
    5 * 60 * 1000,
    internal.testimonialImportAvatar.expireAttempt,
    { itemId: item._id, testimonialId, attempt },
  );
}

const copyArgs = {
  attempt: v.number(),
  itemId: v.id("testimonialImportItems"),
  testimonialId: v.id("testimonials"),
};

export const source = internalQuery({
  args: copyArgs,
  returns: v.union(
    v.null(),
    v.object({ provider: importProvider, url: v.string() }),
  ),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !item ||
      !testimonial ||
      item.testimonialId !== testimonial._id ||
      item.organizationId !== testimonial.organizationId ||
      item.avatarStatus !== "processing" ||
      item.avatarAttempt !== args.attempt ||
      testimonial.avatarStorageId ||
      !item.avatarUrl ||
      testimonial.importOrigin?.originalAvatarUrl !== item.avatarUrl
    )
      return null;
    return { provider: testimonial.importOrigin.provider, url: item.avatarUrl };
  },
});

export const finish = internalMutation({
  args: {
    ...copyArgs,
    sourceUrl: v.string(),
    diagnostic: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    const testimonial = await ctx.db.get(args.testimonialId);
    const organization = testimonial
      ? await ctx.db.get(testimonial.organizationId)
      : null;
    const account = organization?.accountId
      ? await ctx.db.get(organization.accountId)
      : null;
    const deletion = await ctx.db
      .query("videoMediaDeletions")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", args.testimonialId),
      )
      .first();
    const applicable =
      organization &&
      organization.deletionStartedAt === undefined &&
      account?.deletionStartedAt === undefined &&
      !deletion &&
      item &&
      testimonial &&
      item.testimonialId === testimonial._id &&
      item.organizationId === testimonial.organizationId &&
      item.avatarStatus === "processing" &&
      item.avatarAttempt === args.attempt &&
      !testimonial.avatarStorageId &&
      item.avatarUrl === args.sourceUrl &&
      testimonial.importOrigin?.originalAvatarUrl === args.sourceUrl;
    if (!applicable) {
      // A deleted import or a newer photo must not be resurrected/overwritten.
      if (args.storageId && testimonial?.avatarStorageId !== args.storageId)
        await ctx.storage.delete(args.storageId);
      return null;
    }
    if (!args.storageId) {
      await ctx.db.patch(item._id, {
        avatarStatus: "failed",
        avatarDiagnostic: args.diagnostic ?? "COPY_FAILED",
      });
      return null;
    }
    await ctx.db.patch(testimonial._id, { avatarStorageId: args.storageId });
    await ctx.db.patch(item._id, {
      avatarStatus: "ready",
      avatarDiagnostic: undefined,
    });
    const projection = await ctx.db
      .query("publicTestimonialProjections")
      .withIndex("by_testimonial", (q) =>
        q.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (projection)
      await upsertPublicProjection(
        ctx,
        { ...testimonial, avatarStorageId: args.storageId },
        projection.publishedAt,
      );
    return null;
  },
});

export const expireAttempt = internalMutation({
  args: copyArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (
      item?.testimonialId === args.testimonialId &&
      item.avatarAttempt === args.attempt &&
      item.avatarStatus === "processing"
    )
      await ctx.db.patch(item._id, {
        avatarStatus: "failed",
        avatarDiagnostic: "ATTEMPT_EXPIRED",
      });
    return null;
  },
});

export const copy = internalAction({
  args: copyArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const source = await ctx.runQuery(
      internal.testimonialImportAvatar.source,
      args,
    );
    if (!source) return null;
    if (source.provider === "assistant")
      return ctx.runAction(internal.assistantImportMedia.copyPortrait, args);
    let storageId: Id<"_storage"> | undefined;
    let stage = "download";
    try {
      const image = await downloadImportAvatar(source.provider, source.url);
      stage = "storage";
      storageId = await ctx.storage.store(image);
    } catch (error) {
      await ctx.runMutation(internal.testimonialImportAvatar.finish, {
        ...args,
        sourceUrl: source.url,
        diagnostic:
          error instanceof ImportAvatarError
            ? error.diagnostic
            : stage === "storage"
              ? "STORAGE_FAILED"
              : "FETCH_FAILED",
      });
      return null;
    }
    // If mutation delivery is uncertain, retain the file: deleting here could
    // break a successful attachment. Existing orphan cleanup handles unused files.
    await ctx.runMutation(internal.testimonialImportAvatar.finish, {
      ...args,
      sourceUrl: source.url,
      storageId,
    });
    return null;
  },
});
