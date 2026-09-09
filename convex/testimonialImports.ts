import type { Id } from "./_generated/dataModel";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";
import { beginImportFlow, recordImportStage } from "./importAcquisition";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";
import {
  env,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getVideoStorageAvailability } from "./collectionQuotas";
import {
  normalizeImportIdentity,
  hasUnchangedImportContent,
  importResult,
  wallCandidate,
  wallProvider,
} from "./domain/testimonialImport";
import {
  requireOrganizationPermission,
  requireOrganizationPermissionForPrincipal,
} from "./security/organizationAccess";
import schema from "./schema";
import { queueImportedVideo } from "./testimonialImportVideo";
import { isProjectActive } from "./projectActivity";

const previewLimiter = new RateLimiter(components.rateLimiter, {
  wallPreviewOwner: { kind: "fixed window", rate: 10, period: HOUR },
  wallPreviewGlobal: { kind: "fixed window", rate: 500, period: HOUR },
});

function requireStableTextIdentity(
  provider: Infer<typeof wallProvider>,
  item: Infer<typeof wallCandidate>,
) {
  if (
    provider === "testimonial-to" &&
    item.type === "text" &&
    /^text:[a-f0-9]{64}$/.test(item.sourceId)
  )
    throw new ConvexError({
      code: "PREVIEW_SOURCE_CHANGED",
      message: "Read the wall again to refresh its testimonial identities.",
    });
}

export async function findImportSource(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">,
  provider: Infer<typeof wallProvider>,
  sourceUrl: string,
  item: Infer<typeof wallCandidate>,
) {
  const key = JSON.stringify([provider, sourceUrl, item.sourceId]);
  const find = (sourceKey: string) =>
    ctx.db
      .query("testimonials")
      .withIndex("by_organizationId_and_importSourceKey", (q) =>
        q.eq("organizationId", organizationId).eq("importSourceKey", sourceKey),
      )
      .unique();
  const current = await find(key);
  if (current || provider !== "testimonial-to" || item.type !== "text")
    return current;
  // Reconcile the former content-hash key only against an exact original snapshot.
  // This changes the private lookup key, never the captured provenance or proof.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([item.authorName, item.text])),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const legacy = await find(
    JSON.stringify([provider, sourceUrl, `text:${hash}`]),
  );
  if (
    !legacy ||
    legacy.submissionType !== "text" ||
    legacy.importOrigin?.originalAuthorName !== item.authorName ||
    legacy.importOrigin.originalText !== item.text
  )
    return null;
  return legacy;
}

async function resolveImportSource(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  provider: Infer<typeof wallProvider>,
  sourceUrl: string,
  item: Infer<typeof wallCandidate>,
) {
  const existing = await findImportSource(
    ctx,
    organizationId,
    provider,
    sourceUrl,
    item,
  );
  const key = JSON.stringify([provider, sourceUrl, item.sourceId]);
  if (existing && existing.importSourceKey !== key)
    await ctx.db.patch(existing._id, { importSourceKey: key });
  return existing;
}

export const correctIdentity = mutation({
  args: {
    itemId: v.id("testimonialImportItems"),
    authorName: v.string(),
    tagline: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    const job = item ? await ctx.db.get(item.jobId) : null;
    if (!item || !job)
      throw new ConvexError({
        code: "IMPORT_UNAVAILABLE",
        message: "Import unavailable.",
      });
    const { principal } = await requireOrganizationPermission(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
    );
    if (job.expiresAt <= Date.now())
      throw new ConvexError({
        code: "PREVIEW_EXPIRED",
        message: "Read the wall again to refresh this preview.",
      });
    if (
      item.outcome ||
      item.videoStatus ||
      (item.sourceState && item.sourceState !== "new")
    )
      throw new ConvexError({
        code: "IMPORT_ALREADY_PROCESSED",
        message: "Only new testimonials can be corrected before importing.",
      });
    const { authorName, tagline } = normalizeImportIdentity(args);
    await ctx.db.patch(item._id, {
      identityCorrection: {
        authorName,
        tagline,
        editedBy: principal.actorId,
        editedAt: Date.now(),
      },
    });
    return null;
  },
});

export const expirePreview = internalMutation({
  args: { jobId: v.id("testimonialImportJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.expiresAt > Date.now()) return null;
    const items = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (index) => index.eq("jobId", job._id))
      .filter((q) => q.eq(q.field("videoAssetId"), undefined))
      .take(100);
    for (const item of items) await ctx.db.delete(item._id);
    if (items.length === 100)
      await ctx.scheduler.runAfter(
        0,
        internal.testimonialImports.expirePreview,
        args,
      );
    else if (!job.result) await ctx.db.delete(job._id);
    else await ctx.db.patch(job._id, { selectedItemIds: [] });
    return null;
  },
});

export const setSelection = mutation({
  args: {
    jobId: v.id("testimonialImportJobs"),
    itemIds: v.array(v.id("testimonialImportItems")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job)
      throw new ConvexError({
        code: "IMPORT_UNAVAILABLE",
        message: "Import unavailable.",
      });
    await requireOrganizationPermission(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
    );
    if (job.expiresAt <= Date.now())
      throw new ConvexError({
        code: "PREVIEW_EXPIRED",
        message: "Read the wall again to refresh this preview.",
      });
    if (args.itemIds.length > 100)
      throw new ConvexError({
        code: "INVALID_SELECTION",
        message: "Select at most 100 items.",
      });
    const selectedItemIds = [...new Set(args.itemIds)];
    for (const id of selectedItemIds) {
      const item = await ctx.db.get(id);
      if (
        !item ||
        item.jobId !== job._id ||
        item.outcome ||
        item.videoStatus ||
        item.unavailableReason
      )
        throw new ConvexError({
          code: "INVALID_SELECTION",
          message: "Select available items from this preview.",
        });
    }
    await ctx.db.patch(job._id, { selectedItemIds });
    return null;
  },
});

export const confirm = mutation({
  args: {
    jobId: v.id("testimonialImportJobs"),
    itemIds: v.array(v.id("testimonialImportItems")),
  },
  returns: importResult,
  handler: (ctx, args) => confirmOwnedImport(ctx, args),
});

export async function confirmOwnedImport(
  ctx: MutationCtx,
  args: {
    jobId: Id<"testimonialImportJobs">;
    itemIds: Id<"testimonialImportItems">[];
  },
  verifiedPrincipal?: Principal,
) {
  const job = await ctx.db.get(args.jobId);
  if (!job)
    throw new ConvexError({
      code: "IMPORT_UNAVAILABLE",
      message: "Import unavailable.",
    });
  const { principal, organization } =
    await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
      verifiedPrincipal ?? (await requireVerifiedPrincipal(ctx)),
    );
  if (!(await isProjectActive(ctx, organization)))
    throw new ConvexError({
      code: "PROJECT_INACTIVE",
      message: "Choose an active Project for your import.",
    });
  if (job.expiresAt <= Date.now())
    throw new ConvexError({
      code: "PREVIEW_EXPIRED",
      message: "Read the wall again to refresh this preview.",
    });
  if (!args.itemIds.length || args.itemIds.length > 100)
    throw new ConvexError({
      code: "INVALID_SELECTION",
      message: "Select between 1 and 100 items.",
    });
  const result = {
    ...(job.result ?? {
      imported: 0,
      skipped: 0,
      changed: 0,
      unavailable: 0,
    }),
  };
  for (const id of new Set(args.itemIds)) {
    const item = await ctx.db.get(id);
    if (!item || item.jobId !== job._id)
      throw new ConvexError({
        code: "INVALID_SELECTION",
        message: "Select items from this preview.",
      });
    if (item.outcome || item.videoStatus) continue;
    requireStableTextIdentity(job.provider, item);
    if (item.unavailableReason || (item.type === "video" && !item.videoUrl)) {
      result.unavailable++;
      await ctx.db.patch(item._id, { outcome: "unavailable" });
      continue;
    }
    const sourceKey = JSON.stringify([
      job.provider,
      job.sourceUrl,
      item.sourceId,
    ]);
    const existing = await resolveImportSource(
      ctx,
      job.organizationId,
      job.provider,
      job.sourceUrl,
      item,
    );
    if (existing) {
      if (hasUnchangedImportContent(existing, item)) {
        result.skipped++;
        await ctx.db.patch(item._id, {
          outcome: "skipped",
          testimonialId: existing._id,
        });
      } else {
        result.changed++;
        await ctx.db.patch(item._id, {
          outcome: "changed",
          testimonialId: existing._id,
        });
      }
      continue;
    }
    if (item.type === "video") {
      if (await queueImportedVideo(ctx, job, item, principal.actorId)) {
        result.processing = (result.processing ?? 0) + 1;
      } else {
        throw new ConvexError({
          code: "VIDEO_CAPACITY_REACHED",
          message:
            "Video capacity changed. Review your selection before importing again.",
        });
      }
      continue;
    }
    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      importJobId: job._id,
      organizationId: job.organizationId,
      clientSubmissionId: `import:${id}`,
      submissionType: "text",
      moderationStatus: "pending",
      submitterName: item.identityCorrection?.authorName ?? item.authorName,
      text: item.text,
      role: item.identityCorrection
        ? item.identityCorrection.tagline || undefined
        : item.tagline,
      importSourceKey: sourceKey,
      importOrigin: {
        acquisitionFlowId: job.acquisitionFlowId,
        provider: job.provider,
        sourceUrl: job.sourceUrl,
        sourceId: item.sourceId,
        originalText: item.text,
        originalAuthorName: item.authorName,
        originalTagline: item.tagline,
        originalType: item.type,
        importedBy: principal.actorId,
        importedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(item._id, { outcome: "imported", testimonialId });
    result.imported++;
  }
  if (result.imported > 0 || (result.processing ?? 0) > 0)
    await recordImportStage(ctx, job.acquisitionFlowId, "saved");
  await ctx.db.patch(job._id, { result, selectedItemIds: [] });
  return result;
}

export const authorizePreview = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
      ctx,
      args,
      "ownership:manage",
    );
    const ownerLimit = await previewLimiter.limit(ctx, "wallPreviewOwner", {
      key: principal.actorId,
    });
    const globalLimit = ownerLimit.ok
      ? await previewLimiter.limit(ctx, "wallPreviewGlobal")
      : ownerLimit;
    if (!ownerLimit.ok || !globalLimit.ok)
      throw new ConvexError({
        code: "IMPORT_RATE_LIMITED",
        message: "You have previewed several walls recently. Try again later.",
      });
    return null;
  },
});

const ownedPreviewArgs = v.object({
  acquisitionFlowId: v.optional(v.id("importAcquisitionFlows")),
  organizationId: v.id("organizations"),
  provider: wallProvider,
  sourceUrl: v.string(),
  items: v.array(wallCandidate),
});

export async function persistOwnedPreview(
  ctx: MutationCtx,
  args: Infer<typeof ownedPreviewArgs>,
  verifiedPrincipal?: Principal,
) {
  const { principal } = await requireOrganizationPermissionForPrincipal(
    ctx,
    args,
    "ownership:manage",
    verifiedPrincipal ?? (await requireVerifiedPrincipal(ctx)),
  );
  if (
    args.items.length > 500 ||
    new TextEncoder().encode(JSON.stringify(args.items)).byteLength > 500_000
  )
    throw new ConvexError({
      code: "WALL_TOO_LARGE",
      message: "This wall exceeds the preview capacity.",
    });
  const acquisitionFlowId =
    args.acquisitionFlowId ?? (await beginImportFlow(ctx, "workspace"));
  await recordImportStage(ctx, acquisitionFlowId, "previewed");
  const jobId = await ctx.db.insert("testimonialImportJobs", {
    acquisitionFlowId,
    organizationId: args.organizationId,
    createdBy: principal.actorId,
    provider: args.provider,
    sourceUrl: args.sourceUrl,
    itemCount: args.items.length,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
  let hasNewText = false;
  for (const [position, item] of args.items.entries()) {
    requireStableTextIdentity(args.provider, item);
    const existing = await resolveImportSource(
      ctx,
      args.organizationId,
      args.provider,
      args.sourceUrl,
      item,
    );
    const sourceState = !existing
      ? "new"
      : hasUnchangedImportContent(existing, item)
        ? "already_imported"
        : "changed";
    hasNewText ||= item.type === "text" && sourceState === "new";
    await ctx.db.insert("testimonialImportItems", {
      ...item,
      sourceState,
      testimonialId: existing?._id,
      organizationId: args.organizationId,
      jobId,
      position,
    });
  }
  if (args.provider === "testimonial-to" && hasNewText) {
    const prefix = `${JSON.stringify([args.provider, args.sourceUrl]).slice(0, -1)},"text:`;
    const unresolvedLegacy = await ctx.db
      .query("testimonials")
      .withIndex("by_organizationId_and_importSourceKey", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("importSourceKey", prefix)
          .lt("importSourceKey", `${prefix}\uffff`),
      )
      .first();
    if (unresolvedLegacy)
      throw new ConvexError({
        code: "LEGACY_IMPORT_REVIEW_REQUIRED",
        message:
          "Older imports from this wall need review before adding new testimonials. Their source identities could not be matched safely.",
      });
  }
  await ctx.scheduler.runAfter(
    24 * HOUR,
    internal.testimonialImports.expirePreview,
    { jobId },
  );
  return { jobId };
}

export const storePreview = internalMutation({
  args: ownedPreviewArgs.fields,
  returns: v.object({ jobId: v.id("testimonialImportJobs") }),
  handler: persistOwnedPreview,
});

export const getPreview = query({
  args: {
    type: v.optional(v.union(v.literal("text"), v.literal("video"))),
    jobId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.union(
    v.null(),
    v.object({
      result: v.union(importResult, v.null()),
      selectedItemIds: v.array(v.id("testimonialImportItems")),
      sourceUrl: v.string(),
      provider: wallProvider,
      itemCount: v.number(),
      expiresAt: v.number(),
      videoCapacity: v.object({
        used: v.number(),
        limit: v.number(),
        available: v.boolean(),
        configured: v.boolean(),
      }),
      items: paginationResultValidator(schema.doc("testimonialImportItems")),
    }),
  ),
  handler: async (ctx, args) => {
    const jobId = ctx.db.normalizeId("testimonialImportJobs", args.jobId);
    const job = jobId ? await ctx.db.get(jobId) : null;
    if (
      !job ||
      (args.organizationId && job.organizationId !== args.organizationId)
    )
      return null;
    await requireOrganizationPermission(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
    );
    if (args.paginationOpts.numItems > 100)
      throw new ConvexError({
        code: "INVALID_PAGE_SIZE",
        message: "Request at most 100 items.",
      });
    const itemsQuery = ctx.db.query("testimonialImportItems");
    const items = await (
      args.type
        ? itemsQuery.withIndex("by_jobId_type_position", (q) =>
            q.eq("jobId", job._id).eq("type", args.type!),
          )
        : itemsQuery.withIndex("by_jobId_and_position", (q) =>
            q.eq("jobId", job._id),
          )
    ).paginate(args.paginationOpts);
    return {
      result: job.result ?? null,
      selectedItemIds: job.selectedItemIds ?? [],
      sourceUrl: job.sourceUrl,
      provider: job.provider,
      itemCount: job.itemCount,
      expiresAt: job.expiresAt,
      videoCapacity: {
        ...(await getVideoStorageAvailability(ctx, job.organizationId)),
        configured: env.MUX_PROVIDER === "mux" || env.MUX_PROVIDER === "fake",
      },
      items,
    };
  },
});
