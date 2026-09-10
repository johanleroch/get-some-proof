import { authzForOrganization } from "./authorization";
import { ConvexError, v, type Infer } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { importGrant, requireImportPrincipal } from "./importOAuthCommands";
import {
  requireOrganizationPermission,
  requireOrganizationPermissionForPrincipal,
} from "./security/organizationAccess";
import {
  getAccountBillingEntitlement,
  getOrganizationBillingEntitlement,
} from "./billingEntitlements";
import type { ImportAccessGrant } from "./domain/importAccessToken";
import { listImportDestinations } from "./anonymousWallImports";
import { confirmOwnedImport } from "./testimonialImports";
import { getVideoStorageAvailability } from "./collectionQuotas";
import { retryOwnedImportVideo } from "./testimonialImportVideo";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";
import type { Id } from "./_generated/dataModel";
import { retryOwnedImportAvatar } from "./testimonialImportAvatar";
import {
  importResult,
  assistantReuseRightsText,
  assistantOutcome,
} from "./domain/testimonialImport";
import {
  richTextValidator,
  normalizeRichText,
  richTextToPlain,
} from "./domain/testimonialRichText";

export const activation = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({ paid: v.boolean(), activated: v.boolean() }),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
      ctx,
      args,
      "ownership:manage",
    );
    const [entitlement, activation] = await Promise.all([
      getOrganizationBillingEntitlement(ctx, args.organizationId),
      ctx.db
        .query("assistantImportActivations")
        .withIndex("by_actorId", (q) => q.eq("actorId", principal.actorId))
        .unique(),
    ]);
    return {
      paid: entitlement.effectivePlan === "premium",
      activated: !!activation,
    };
  },
});

export async function requirePaidAssistant(
  ctx: QueryCtx | MutationCtx,
  grant: ImportAccessGrant,
) {
  const principal = await requireImportPrincipal(ctx, grant);
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
    .unique();
  const entitlement = account
    ? await getAccountBillingEntitlement(ctx, account._id)
    : null;
  if (
    !entitlement ||
    entitlement.effectivePlan !== "premium" ||
    entitlement.state === "past_due"
  )
    throw new ConvexError("Pro is required for assistant imports.");
  return principal;
}

export const destinations = internalQuery({
  args: { grant: importGrant, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({ id: v.id("organizations"), name: v.string(), slug: v.string() }),
  ),
  handler: async (ctx, args) =>
    listImportDestinations(
      ctx,
      await requirePaidAssistant(ctx, args.grant),
      args.paginationOpts,
    ),
});

export const status = internalQuery({
  args: { grant: importGrant, jobId: v.id("testimonialImportJobs") },
  returns: v.object({
    jobId: v.id("testimonialImportJobs"),
    organizationSlug: v.string(),
    result: importResult,
    availableVideoSlots: v.number(),
    outcomes: v.array(assistantOutcome),
    photos: v.array(
      v.object({
        itemId: v.id("testimonialImportItems"),
        authorName: v.string(),
        status: v.union(
          v.literal("processing"),
          v.literal("ready"),
          v.literal("failed"),
        ),
      }),
    ),
    videos: v.array(
      v.object({
        itemId: v.id("testimonialImportItems"),
        authorName: v.string(),
        blocked: v.optional(v.boolean()),
        failureMessage: v.optional(v.string()),
        status: v.union(
          v.literal("processing"),
          v.literal("ready"),
          v.literal("failed"),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePaidAssistant(ctx, args.grant);
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.provider !== "assistant" ||
      job.createdBy !== principal.actorId ||
      !job.result
    )
      throw new ConvexError("Import unavailable.");
    const { organization } = await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
      principal,
    );
    const [items, capacity] = await Promise.all([
      ctx.db
        .query("testimonialImportItems")
        .withIndex("by_jobId_and_position", (q) => q.eq("jobId", job._id))
        .take(50),
      getVideoStorageAvailability(ctx, job.organizationId),
    ]);
    return {
      availableVideoSlots: capacity.available
        ? Math.max(0, capacity.limit - capacity.used)
        : 0,
      jobId: job._id,
      organizationSlug: organization.slug,
      result: job.result,
      outcomes: await outcomes(ctx, job._id),
      photos: items.flatMap((item) =>
        item.avatarStatus
          ? [
              {
                itemId: item._id,
                authorName: item.authorName,
                status: item.avatarStatus,
              },
            ]
          : [],
      ),
      videos: items.flatMap((item) =>
        item.videoStatus
          ? [
              {
                itemId: item._id,
                authorName: item.authorName,
                status: item.videoStatus,
                blocked: item.capacityBlocked,
                failureMessage: item.capacityBlocked
                  ? "Choose which videos fit your available capacity."
                  : item.failureReason,
              },
            ]
          : [],
      ),
    };
  },
});

export const retryPortrait = internalMutation({
  args: {
    grant: importGrant,
    jobId: v.id("testimonialImportJobs"),
    itemId: v.id("testimonialImportItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requirePaidAssistant(ctx, args.grant);
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.provider !== "assistant" ||
      job.createdBy !== principal.actorId
    )
      throw new ConvexError("Import unavailable.");
    return retryOwnedImportAvatar(ctx, args.itemId, principal, job._id);
  },
});

export const activate = mutation({
  args: {
    organizationId: v.id("organizations"),
    acceptReuseRights: v.literal(true),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
      ctx,
      args,
      "ownership:manage",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      args.organizationId,
    );
    if (entitlement.effectivePlan !== "premium")
      throw new ConvexError("Pro is required for assistant imports.");
    const existing = await ctx.db
      .query("assistantImportActivations")
      .withIndex("by_actorId", (q) => q.eq("actorId", principal.actorId))
      .unique();
    if (!existing)
      await ctx.db.insert("assistantImportActivations", {
        actorId: principal.actorId,
        acceptedAt: Date.now(),
        version: "2026-09-10",
        text: assistantReuseRightsText,
      });
    return null;
  },
});

const assistantRecord = v.object({
  type: v.optional(v.union(v.literal("text"), v.literal("video"))),
  videoUrl: v.optional(v.string()),
  sourceId: v.string(),
  authorName: v.string(),
  text: v.string(),
  role: v.optional(v.string()),
  company: v.optional(v.string()),
  rating: v.optional(v.number()),
  richText: v.optional(richTextValidator),
  portraitUrl: v.optional(v.string()),
});
const batchArgs = v.object({
  grant: importGrant,
  organizationId: v.optional(v.id("organizations")),
  sourceUrl: v.string(),
  migrationId: v.optional(v.string()),
  requestId: v.string(),
  discoveredCount: v.number(),
  items: v.array(assistantRecord),
});
const batchResponse = v.object({
  jobId: v.id("testimonialImportJobs"),
  organizationSlug: v.string(),
  result: importResult,
  outcomes: v.array(assistantOutcome),
});

function normalizedRecord(item: Infer<typeof assistantRecord>) {
  if (
    !item.sourceId.trim() ||
    item.sourceId.length > 200 ||
    item.authorName.length > 100 ||
    ((item.type ?? "text") === "text" && !item.text.trim()) ||
    item.text.length > 10_000
  )
    throw new ConvexError({ code: "ASSISTANT_SOURCE_IDENTITY" });
  if (
    (item.portraitUrl?.length ?? 0) > 2048 ||
    (item.role?.length ?? 0) > 200 ||
    (item.company?.length ?? 0) > 200 ||
    (item.rating !== undefined &&
      (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5))
  )
    throw new ConvexError(
      "Supply bounded explicit identity fields and an individual rating from 1 to 5.",
    );
  if (item.richText && richTextToPlain(item.richText) !== item.text)
    throw new ConvexError("Highlights must preserve original words exactly.");
  return {
    sourceId: item.sourceId,
    authorName: item.authorName,
    text: item.text,
    type: item.type ?? "text",
    videoUrl: item.videoUrl,
    tagline: item.role,
    company: item.company,
    rating: item.rating,
    richText: normalizeRichText(item.richText, item.text),
    avatarUrl: item.portraitUrl,
  };
}

async function outcomes(
  ctx: QueryCtx | MutationCtx,
  jobId: import("./_generated/dataModel").Id<"testimonialImportJobs">,
): Promise<Infer<typeof assistantOutcome>[]> {
  const items = await ctx.db
    .query("testimonialImportItems")
    .withIndex("by_jobId_and_position", (q) => q.eq("jobId", jobId))
    .take(50);
  return items.map((item) => ({
    sourceId: item.sourceId,
    itemId: item._id,
    status: item.capacityBlocked
      ? "blocked"
      : item.outcome === "imported"
        ? "created"
        : item.outcome === "skipped"
          ? "duplicate"
          : item.outcome === "changed"
            ? "conflict"
            : item.videoStatus === "processing"
              ? "processing"
              : "failed",
  }));
}

async function acceptBatch(
  ctx: MutationCtx,
  args: Infer<typeof batchArgs>,
): Promise<Infer<typeof batchResponse>> {
  const principal = await requirePaidAssistant(ctx, args.grant);
  let organizationId = args.organizationId;
  if (!organizationId) {
    const projects = await listImportDestinations(ctx, principal, {
      cursor: null,
      numItems: 20,
    });
    if (!projects.isDone || projects.page.length !== 1)
      throw new ConvexError("Choose an owned Project before importing.");
    organizationId = projects.page[0].id;
  }
  const { organization } = await requireOrganizationPermissionForPrincipal(
    ctx,
    { organizationId },
    "ownership:manage",
    principal,
  );
  const activation = await ctx.db
    .query("assistantImportActivations")
    .withIndex("by_actorId", (q) => q.eq("actorId", principal.actorId))
    .unique();
  if (!activation)
    throw new ConvexError(
      "Confirm your reuse rights on the MCP setup screen before importing.",
    );
  if (
    !args.items.length ||
    args.items.length > 50 ||
    !args.requestId.trim() ||
    args.requestId.length > 128 ||
    !Number.isInteger(args.discoveredCount) ||
    args.discoveredCount < args.items.length ||
    new TextEncoder().encode(JSON.stringify(args.items)).byteLength > 500_000
  )
    throw new ConvexError({ code: "ASSISTANT_BATCH_LIMIT" });
  let source: URL;
  try {
    source = new URL(args.sourceUrl);
  } catch {
    throw new ConvexError("Provide a source page URL.");
  }
  if (
    !["http:", "https:"].includes(source.protocol) ||
    source.username ||
    source.password ||
    args.sourceUrl.length > 2048
  )
    throw new ConvexError("Provide a source page URL without credentials.");
  const items = args.items.map(normalizedRecord);
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      source: source.href,
      items,
      discoveredCount: args.discoveredCount,
      migrationId: args.migrationId,
    }),
  );
  const inputHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const existing = await ctx.db
    .query("testimonialImportJobs")
    .withIndex("by_organizationId_and_requestId", (q) =>
      q.eq("organizationId", organizationId).eq("requestId", args.requestId),
    )
    .unique();
  if (existing) {
    if (
      existing.createdBy !== principal.actorId ||
      existing.provider !== "assistant" ||
      existing.inputHash !== inputHash ||
      !existing.result
    )
      throw new ConvexError({ code: "ASSISTANT_BATCH_CONFLICT" });
    return {
      jobId: existing._id,
      organizationSlug: organization.slug,
      result: existing.result,
      outcomes: await outcomes(ctx, existing._id),
    };
  }
  const clientId = args.migrationId ?? args.requestId;
  if (!clientId.trim() || clientId.length > 128)
    throw new ConvexError({ code: "ASSISTANT_BATCH_LIMIT" });
  const previousMigration = await ctx.db
    .query("assistantImportMigrations")
    .withIndex("by_organizationId_and_clientId", (q) =>
      q.eq("organizationId", organizationId).eq("clientId", clientId),
    )
    .unique();
  if (
    previousMigration &&
    (previousMigration.actorId !== principal.actorId ||
      previousMigration.sourceUrl !== source.href ||
      previousMigration.discoveredCount !== args.discoveredCount)
  )
    throw new ConvexError({ code: "ASSISTANT_BATCH_CONFLICT" });
  const migrationId =
    previousMigration?._id ??
    (await ctx.db.insert("assistantImportMigrations", {
      organizationId,
      actorId: principal.actorId,
      clientId,
      sourceUrl: source.href,
      discoveredCount: args.discoveredCount,
      processedCount: 0,
      batchCount: 0,
      result: { imported: 0, skipped: 0, changed: 0, unavailable: 0 },
    }));
  const now = Date.now();
  const jobId = await ctx.db.insert("testimonialImportJobs", {
    organizationId,
    createdBy: principal.actorId,
    provider: "assistant",
    sourceUrl: source.href,
    requestId: args.requestId,
    migrationId,
    inputHash,
    itemCount: items.length,
    createdAt: now,
    expiresAt: now + 86400_000,
  });
  const itemIds = [];
  for (const [position, item] of items.entries())
    itemIds.push(
      await ctx.db.insert("testimonialImportItems", {
        ...item,
        organizationId,
        jobId,
        position,
      }),
    );
  const result = await confirmOwnedImport(ctx, { jobId, itemIds }, principal);
  const migration = (await ctx.db.get(migrationId))!;
  let processedCount = migration.processedCount;
  for (const item of items) {
    const tracked = await ctx.db
      .query("assistantImportMigrationSources")
      .withIndex("by_migrationId_and_sourceId", (q) =>
        q.eq("migrationId", migrationId).eq("sourceId", item.sourceId),
      )
      .unique();
    if (!tracked) {
      await ctx.db.insert("assistantImportMigrationSources", {
        migrationId,
        sourceId: item.sourceId,
      });
      processedCount++;
    }
  }
  const aggregate = { ...migration.result };
  for (const key of [
    "imported",
    "skipped",
    "changed",
    "unavailable",
    "processing",
    "failed",
    "blocked",
  ] as const)
    aggregate[key] = (aggregate[key] ?? 0) + (result[key] ?? 0);
  await ctx.db.patch(migrationId, {
    processedCount,
    batchCount: migration.batchCount + 1,
    result: aggregate,
  });

  return {
    jobId,
    organizationSlug: organization.slug,
    result,
    outcomes: await outcomes(ctx, jobId),
  };
}

export const submitBatch = internalMutation({
  args: batchArgs.fields,
  returns: batchResponse,
  handler: acceptBatch,
});
export const submitText = internalMutation({
  args: {
    grant: importGrant,
    organizationId: v.optional(v.id("organizations")),
    sourceUrl: v.string(),
    ...assistantRecord.fields,
  },
  returns: batchResponse,
  handler: (ctx, args) => {
    const { grant, organizationId, sourceUrl, ...item } = args;
    return acceptBatch(ctx, {
      grant,
      organizationId,
      sourceUrl,
      items: [item],
      requestId: crypto.randomUUID(),
      discoveredCount: 1,
    });
  },
});

export const migrationStatus = internalQuery({
  args: {
    grant: importGrant,
    organizationId: v.id("organizations"),
    migrationId: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    migrationId: v.string(),
    discoveredCount: v.number(),
    processedCount: v.number(),
    remainingCount: v.number(),
    batchCount: v.number(),
    result: importResult,
    page: v.array(
      v.object({
        jobId: v.id("testimonialImportJobs"),
        result: v.optional(importResult),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const principal = await requirePaidAssistant(ctx, args.grant);
    await requireOrganizationPermissionForPrincipal(
      ctx,
      args,
      "ownership:manage",
      principal,
    );
    const migration = await ctx.db
      .query("assistantImportMigrations")
      .withIndex("by_organizationId_and_clientId", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("clientId", args.migrationId),
      )
      .unique();
    if (!migration || migration.actorId !== principal.actorId)
      throw new ConvexError("Import unavailable.");
    const jobs = await ctx.db
      .query("testimonialImportJobs")
      .withIndex("by_migrationId", (q) => q.eq("migrationId", migration._id))
      .paginate({ cursor: args.cursor, numItems: 20 });
    return {
      migrationId: migration.clientId,
      discoveredCount: migration.discoveredCount,
      processedCount: migration.processedCount,
      remainingCount: Math.max(
        0,
        migration.discoveredCount - migration.processedCount,
      ),
      batchCount: migration.batchCount,
      result: migration.result,
      page: jobs.page.map((job) => ({ jobId: job._id, result: job.result })),
      isDone: jobs.isDone,
      continueCursor: jobs.continueCursor,
    };
  },
});

const mediaProgress = v.union(
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
);
export const inboxStatus = query({
  args: { organizationId: v.id("organizations"), jobId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("testimonialImportJobs"),
      sourceUrl: v.string(),
      createdAt: v.number(),
      result: importResult,
      createdCount: v.number(),
      readyCount: v.number(),
      availableVideoSlots: v.number(),
      canUpload: v.boolean(),
      items: v.array(
        v.object({
          itemId: v.id("testimonialImportItems"),
          authorName: v.string(),
          videoStatus: v.optional(mediaProgress),
          portraitStatus: v.optional(mediaProgress),
          blocked: v.boolean(),
          failureMessage: v.optional(v.string()),
          hasVideoUrl: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const id = ctx.db.normalizeId("testimonialImportJobs", args.jobId);
    const job = id ? await ctx.db.get(id) : null;
    if (
      !job ||
      job.organizationId !== args.organizationId ||
      job.createdBy !== principal.actorId ||
      job.provider !== "assistant" ||
      !job.result
    )
      return null;
    const [entitlement, items, capacity] = await Promise.all([
      getOrganizationBillingEntitlement(ctx, job.organizationId),
      ctx.db
        .query("testimonialImportItems")
        .withIndex("by_jobId_and_position", (q) => q.eq("jobId", job._id))
        .take(50),
      getVideoStorageAvailability(ctx, job.organizationId),
    ]);
    return {
      jobId: job._id,
      sourceUrl: job.sourceUrl,
      createdAt: job.createdAt,
      result: job.result,
      createdCount: items.filter(
        (item) =>
          item.testimonialId &&
          item.outcome !== "skipped" &&
          item.outcome !== "changed",
      ).length,
      readyCount: items.filter((item) => item.videoStatus === "ready").length,
      availableVideoSlots: capacity.available
        ? Math.max(0, capacity.limit - capacity.used)
        : 0,
      canUpload:
        entitlement.effectivePlan === "premium" &&
        entitlement.state !== "past_due",
      items: items.map((item) => ({
        itemId: item._id,
        authorName: item.authorName,
        videoStatus: item.videoStatus,
        portraitStatus: item.avatarStatus,
        blocked: item.capacityBlocked ?? false,
        failureMessage: item.failureReason,
        hasVideoUrl: !!item.videoUrl,
      })),
    };
  },
});

const resumeVideoArgs = {
  jobId: v.id("testimonialImportJobs"),
  itemIds: v.array(v.id("testimonialImportItems")),
};
async function resumeOwnedVideos(
  ctx: MutationCtx,
  args: {
    jobId: Id<"testimonialImportJobs">;
    itemIds: Id<"testimonialImportItems">[];
  },
  principal: Principal,
) {
  const job = await ctx.db.get(args.jobId);
  if (
    !job ||
    job.provider !== "assistant" ||
    job.createdBy !== principal.actorId
  )
    throw new ConvexError("Import unavailable.");
  await requireOrganizationPermissionForPrincipal(
    ctx,
    { organizationId: job.organizationId },
    "ownership:manage",
    principal,
  );
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    job.organizationId,
  );
  if (
    entitlement.effectivePlan !== "premium" ||
    entitlement.state === "past_due"
  )
    throw new ConvexError("Pro is required to start another media transfer.");
  if (
    !args.itemIds.length ||
    args.itemIds.length > 50 ||
    new Set(args.itemIds).size !== args.itemIds.length
  )
    throw new ConvexError("Choose between 1 and 50 distinct failed videos.");
  const items = await Promise.all(args.itemIds.map((id) => ctx.db.get(id)));
  for (const item of items) {
    if (
      !item ||
      item.jobId !== job._id ||
      item.organizationId !== job.organizationId ||
      item.type !== "video" ||
      item.videoStatus !== "failed" ||
      !item.testimonialId
    )
      throw new ConvexError({
        code: "INVALID_RETRY",
        message: "Only failed videos from this import can be resumed.",
      });
    if (!item.videoUrl)
      throw new ConvexError({
        code: "INVALID_RETRY",
        message:
          "Choose the original local file for videos without a public file URL.",
      });
  }
  const capacity = await getVideoStorageAvailability(ctx, job.organizationId);
  const available = capacity.available
    ? Math.max(0, capacity.limit - capacity.used)
    : 0;
  if (args.itemIds.length > available)
    throw new ConvexError({
      code: "VIDEO_CAPACITY_REACHED",
      message: `Choose at most ${available} videos with the storage currently available.`,
    });
  // Each reservation observes the preceding writes. A failure rolls back the
  // whole explicit selection, including workflow scheduling.
  for (const itemId of args.itemIds)
    await retryOwnedImportVideo(ctx, itemId, principal, job._id);
  return null;
}
export const resumeVideos = mutation({
  args: resumeVideoArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    resumeOwnedVideos(ctx, args, await requireVerifiedPrincipal(ctx)),
});
export const resumeVideosForAssistant = internalMutation({
  args: { ...resumeVideoArgs, grant: importGrant },
  returns: v.null(),
  handler: async (ctx, args) =>
    resumeOwnedVideos(ctx, args, await requirePaidAssistant(ctx, args.grant)),
});

export const recent = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      jobId: v.id("testimonialImportJobs"),
      sourceUrl: v.string(),
      createdAt: v.number(),
      result: v.optional(importResult),
    }),
  ),
  handler: async (ctx, args) => {
    const { principal, tenantId } = await requireOrganizationPermission(
      ctx,
      args,
      "organization:read",
    );
    if (
      !(await authzForOrganization(tenantId).can(
        ctx,
        principal.actorId,
        "ownership:manage",
      ))
    )
      return [];
    const jobs = await ctx.db
      .query("testimonialImportJobs")
      .withIndex("by_organizationId_and_provider_and_createdBy", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("provider", "assistant")
          .eq("createdBy", principal.actorId),
      )
      .order("desc")
      .take(10);
    return jobs.map((job) => ({
      jobId: job._id,
      sourceUrl: job.sourceUrl,
      createdAt: job.createdAt,
      result: job.result,
    }));
  },
});
