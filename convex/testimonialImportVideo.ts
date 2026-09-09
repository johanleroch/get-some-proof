import {
  cancel,
  cleanup,
  defineWorkflow,
  sendEvent,
  start,
  vResultValidator,
  vWorkflowId,
  type WorkflowId,
} from "@convex-dev/workflow";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  env,
  internalAction,
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { getVideoStorageAvailability } from "./collectionQuotas";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { retainAccountVideo } from "./billingDowngrade";
import { isProjectActive } from "./projectActivity";
import {
  enqueueAssetCleanup,
  enqueueVideoAssetCleanup,
} from "./testimonialDeletion";
import { createVideoAssetFromUrl } from "./videoProvider";
import { resolveImportCleanup } from "./videoImportCleanup";
import { queueImportedAvatar } from "./testimonialImportAvatar";
import { requireOrganizationPermissionForPrincipal } from "./security/organizationAccess";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";

const copyLifetimeMs = 2 * 60 * 60 * 1000;

/** Called inside the confirmation transaction, so concurrent imports share capacity. */
export async function queueImportedVideo(
  ctx: MutationCtx,
  job: Doc<"testimonialImportJobs">,
  item: Doc<"testimonialImportItems">,
  actorId: string,
): Promise<boolean> {
  const organization = await ctx.db.get(job.organizationId);
  const capacity = await getVideoStorageAvailability(ctx, job.organizationId);
  if (
    !organization ||
    !(await isProjectActive(ctx, organization)) ||
    !capacity.available ||
    !item.videoUrl ||
    (env.MUX_PROVIDER !== "mux" && env.MUX_PROVIDER !== "fake")
  )
    return false;
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    job.organizationId,
  );
  const now = Date.now();
  const testimonialId =
    item.testimonialId ??
    (await ctx.db.insert("testimonials", {
      importJobId: job._id,
      organizationId: job.organizationId,
      clientSubmissionId: `import:${item._id}`,
      submissionType: "video",
      avatarStorageId: item.identityCorrection?.avatarStorageId ?? undefined,
      moderationStatus: "pending",
      submitterName: item.identityCorrection?.authorName ?? item.authorName,
      text: item.text,
      richText: item.richText,
      role: item.identityCorrection
        ? item.identityCorrection.tagline || undefined
        : item.tagline,
      importSourceKey: JSON.stringify([
        job.provider,
        job.sourceUrl,
        item.sourceId,
      ]),
      importOrigin: {
        acquisitionFlowId: job.acquisitionFlowId,
        provider: job.provider,
        sourceUrl: job.sourceUrl,
        sourceId: item.sourceId,
        originalAuthorName: item.authorName,
        originalText: item.text,
        originalTagline: item.tagline,
        originalType: item.type,
        originalVideoUrl: item.videoUrl,
        originalAvatarUrl: item.avatarUrl,
        importedBy: actorId,
        importedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }));
  if (item.videoAssetId) {
    const previousAsset = await ctx.db.get(item.videoAssetId);
    if (previousAsset)
      await ctx.db.patch(previousAsset._id, { testimonialId: undefined });
  }
  const reservationId = await ctx.db.insert("videoReservations", {
    accountId: organization.accountId,
    organizationId: organization._id,
    importItemId: item._id,
    clientSubmissionId: `import:${item._id}`,
    plan: entitlement.effectivePlan,
    status: "reserved",
    expiresAt: now + copyLifetimeMs,
    createdAt: now,
    updatedAt: now,
  });
  const assetId = await ctx.db.insert("videoAssets", {
    accountId: organization.accountId,
    organizationId: organization._id,
    reservationId,
    testimonialId,
    importItemId: item._id,
    provider: env.MUX_PROVIDER,
    status: "processing",
    mimeType: "video/mp4",
    captionsStatus: "requested",
    createdAt: now,
    updatedAt: now,
  });
  await retainAccountVideo(ctx, (await ctx.db.get(assetId))!);
  const workflowId = await start(
    ctx,
    internal.testimonialImportVideo.copyWorkflow,
    { assetId },
    {
      startAsync: true,
      onComplete: internal.testimonialImportVideo.completed,
      context: { assetId },
    },
  );
  await ctx.db.patch(item._id, {
    testimonialId,
    videoAssetId: assetId,
    workflowId,
    videoStatus: "processing",
    failureReason: undefined,
  });
  await queueImportedAvatar(ctx, item, testimonialId);
  await ctx.scheduler.runAfter(
    copyLifetimeMs,
    internal.video.expireReservation,
    { reservationId },
  );
  return true;
}

/** Shared retry policy for the website session and verified import OAuth grants. */
export async function retryOwnedImportVideo(
  ctx: MutationCtx,
  itemId: Id<"testimonialImportItems">,
  verifiedPrincipal: Principal,
  expectedJobId?: Id<"testimonialImportJobs">,
) {
  const item = await ctx.db.get(itemId);
  const job = item ? await ctx.db.get(item.jobId) : null;
  if (!item || !job || (expectedJobId && job._id !== expectedJobId))
    throw new ConvexError({
      code: "IMPORT_UNAVAILABLE",
      message: "Import unavailable.",
    });
  const { principal } = await requireOrganizationPermissionForPrincipal(
    ctx,
    { organizationId: job.organizationId },
    "ownership:manage",
    verifiedPrincipal,
  );
  if (item.videoStatus === "processing") return null;
  if (
    item.videoStatus !== "failed" ||
    !item.testimonialId ||
    !(await ctx.db.get(item.testimonialId))
  )
    throw new ConvexError({
      code: "INVALID_RETRY",
      message: "Only failed video copies can be retried.",
    });
  if (item.workflowId)
    await cancel(ctx, components.workflow, item.workflowId as WorkflowId);
  if (!(await queueImportedVideo(ctx, job, item, principal.actorId)))
    throw new ConvexError({
      code: "VIDEO_CAPACITY_REACHED",
      message:
        "Free a video storage place or wait for cleanup before retrying.",
    });
  const result = job.result ?? {
    imported: 0,
    skipped: 0,
    changed: 0,
    unavailable: 0,
  };
  await ctx.db.patch(job._id, {
    result: {
      ...result,
      failed: Math.max(0, (result.failed ?? 0) - 1),
      processing: (result.processing ?? 0) + 1,
    },
  });
  return null;
}

export const retry = mutation({
  args: { itemId: v.id("testimonialImportItems") },
  returns: v.null(),
  handler: async (ctx, args) =>
    retryOwnedImportVideo(
      ctx,
      args.itemId,
      await requireVerifiedPrincipal(ctx),
    ),
});

/** Reconcile a terminal media state with the import, once, in the same transaction. */
export async function settleImportedVideo(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  notify = true,
): Promise<void> {
  if (
    !asset.importItemId ||
    (asset.status !== "ready" && asset.status !== "failed")
  )
    return;
  const item = await ctx.db.get(asset.importItemId);
  if (
    !item ||
    item.videoAssetId !== asset._id ||
    item.videoStatus !== "processing"
  )
    return;
  const job = await ctx.db.get(item.jobId);
  if (!job) return;
  const result = job.result ?? {
    imported: 0,
    skipped: 0,
    changed: 0,
    unavailable: 0,
  };
  await ctx.db.patch(item._id, {
    videoStatus: asset.status,
    outcome: asset.status === "ready" ? "imported" : undefined,
    failureReason: asset.failureReason,
  });
  await ctx.db.patch(job._id, {
    result: {
      ...result,
      processing: Math.max(0, (result.processing ?? 0) - 1),
      imported: result.imported + (asset.status === "ready" ? 1 : 0),
      failed: (result.failed ?? 0) + (asset.status === "failed" ? 1 : 0),
    },
  });
  if (notify && item.workflowId)
    await sendEvent(ctx, components.workflow, {
      workflowId: item.workflowId as WorkflowId,
      name: "asset-settled",
      value: null,
    });
}

export const copyWorkflow = defineWorkflow(components.workflow, {
  args: { assetId: v.id("videoAssets") },
  returns: v.null(),
}).handler(async (step, args): Promise<null> => {
  const running = await step.runAction(
    internal.testimonialImportVideo.copySource,
    args,
    { retry: false },
  );
  if (running)
    await step.awaitEvent({ name: "asset-settled", validator: v.null() });
  return null;
});

export const getCopyContext = internalMutation({
  args: { assetId: v.id("videoAssets") },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      organizationId: v.id("organizations"),
      reservationId: v.id("videoReservations"),
      provider: v.union(v.literal("fake"), v.literal("mux")),
    }),
  ),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (
      !asset?.importItemId ||
      asset.status !== "processing" ||
      asset.importCopyStartedAt !== undefined
    )
      return null;
    const item = await ctx.db.get(asset.importItemId);
    const organization = await ctx.db.get(asset.organizationId);
    const reservation = await ctx.db.get(asset.reservationId);
    if (
      !item?.videoUrl ||
      item.videoAssetId !== asset._id ||
      !organization ||
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.expiresAt <= Date.now() ||
      organization.deletionStartedAt !== undefined
    )
      return null;
    await ctx.db.patch(asset._id, { importCopyStartedAt: Date.now() });
    return {
      url: item.videoUrl,
      organizationId: asset.organizationId,
      reservationId: asset.reservationId,
      provider: asset.provider,
    };
  },
});

export const copySource = internalAction({
  args: { assetId: v.id("videoAssets") },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const context = await ctx.runMutation(
      internal.testimonialImportVideo.getCopyContext,
      args,
    );
    if (!context) return false;
    let copy;
    try {
      copy = await createVideoAssetFromUrl({
        url: context.url,
        organizationId: context.organizationId,
        passthrough: context.reservationId,
        provider: context.provider,
      });
    } catch {
      await ctx.runMutation(internal.testimonialImportVideo.rejectCopy, {
        ...args,
        reason:
          "The video could not be copied. Check the source and try again.",
      });
      return true;
    }
    // A persistence failure after POST is uncertain, never a definite rejection.
    await ctx.runMutation(internal.testimonialImportVideo.attachCopy, {
      ...args,
      reservationId: context.reservationId,
      organizationId: context.organizationId,
      provider: copy.provider,
      providerAssetId: copy.providerAssetId,
      fileSizeBytes: copy.fileSizeBytes,
    });
    return true;
  },
});

export const attachCopy = internalMutation({
  args: {
    assetId: v.id("videoAssets"),
    reservationId: v.id("videoReservations"),
    organizationId: v.id("organizations"),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerAssetId: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.providerAssetId)
      await resolveImportCleanup(ctx, args.reservationId, args.providerAssetId);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.status === "failed") {
      if (args.providerAssetId)
        await enqueueAssetCleanup(ctx, {
          organizationId: args.organizationId,
          provider: args.provider,
          providerAssetId: args.providerAssetId,
          testimonialId: asset?.testimonialId,
        });
      return null;
    }
    await ctx.db.patch(asset._id, {
      providerAssetId: args.providerAssetId ?? asset.providerAssetId,
      fileSizeBytes: args.fileSizeBytes,
      updatedAt: Date.now(),
    });
    return null;
  },
});

async function failCopyRecord(
  ctx: MutationCtx,
  assetId: Id<"videoAssets">,
  reason: string,
  notify = true,
) {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.status === "ready" || asset.status === "failed") return;
  await enqueueVideoAssetCleanup(ctx, asset);
  const reservation = await ctx.db.get(asset.reservationId);
  if (reservation)
    await ctx.db.patch(reservation._id, {
      status: "released",
      freeCreditPending: undefined,
      updatedAt: Date.now(),
    });
  await ctx.db.patch(assetId, {
    status: "failed",
    failureReason: reason,
    updatedAt: Date.now(),
  });
  await settleImportedVideo(
    ctx,
    { ...asset, status: "failed", failureReason: reason },
    notify,
  );
}

export const failCopy = internalMutation({
  args: { assetId: v.id("videoAssets"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await failCopyRecord(ctx, args.assetId, args.reason);
    return null;
  },
});

/** Only called when the provider proves no asset was created. */
export const rejectCopy = internalMutation({
  args: { assetId: v.id("videoAssets"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (asset)
      await ctx.db.patch(asset._id, { importCopyStartedAt: undefined });
    const intent = await ctx.db
      .query("videoImportCleanupIntents")
      .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
      .unique();
    if (intent) await ctx.db.delete(intent._id);
    await failCopyRecord(ctx, args.assetId, args.reason);
    return null;
  },
});

export const completed = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ assetId: v.id("videoAssets") }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.result.kind !== "success")
      await failCopyRecord(
        ctx,
        args.context.assetId,
        "The video import was interrupted.",
        false,
      );
    const asset = await ctx.db.get(args.context.assetId);
    const item = asset?.importItemId
      ? await ctx.db.get(asset.importItemId)
      : null;
    if (item?.workflowId === args.workflowId)
      await ctx.db.patch(item._id, { workflowId: undefined });
    await cleanup(ctx, components.workflow, args.workflowId);
    return null;
  },
});
