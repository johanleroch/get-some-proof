import { retryOwnedImportAvatar } from "./testimonialImportAvatar";
import { isProjectActive } from "./projectActivity";
import { getVideoStorageAvailability } from "./collectionQuotas";
import { confirmOwnedImport } from "./testimonialImports";
import {
  assessImportSelection,
  eligibility as eligibilityValidator,
} from "./importEligibility";
import { retryOwnedImportVideo } from "./testimonialImportVideo";
import { requireOrganizationPermissionForPrincipal } from "./security/organizationAccess";
import { hashSubmissionManagementToken } from "./domain/submission";
import { importResult } from "./domain/testimonialImport";
import { v, ConvexError } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  internalQuery,
  internalMutation,
  env,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { ImportAccessGrant } from "./domain/importAccessToken";
import { components } from "./_generated/api";
import {
  listImportDestinations,
  claimOwnedPreview,
} from "./anonymousWallImports";

export const importGrant = v.object({
  actorId: v.string(),
  clientId: v.string(),
  issuedAt: v.number(),
  verifiedAt: v.number(),
  expiresAt: v.number(),
});

export const eligibility = internalMutation({
  args: {
    grant: importGrant,
    token: v.string(),
    organizationId: v.id("organizations"),
  },
  returns: eligibilityValidator,
  handler: async (ctx, args) => {
    const principal = await requireImportPrincipal(ctx, args.grant);
    await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
      principal,
    );
    if (!/^[a-f0-9]{64}$/.test(args.token))
      throw new ConvexError("Preview unavailable.");
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!preview || preview.claimedBy || preview.expiresAt <= Date.now())
      throw new ConvexError("Preview unavailable.");
    return assessImportSelection(
      ctx,
      args.organizationId,
      preview.provider,
      preview.sourceUrl,
      preview.selectedPositions.map((position) => ({
        key: String(position),
        item: preview.items[position],
      })),
    );
  },
});

export async function requireImportPrincipal(
  ctx: QueryCtx | MutationCtx,
  grant: ImportAccessGrant,
) {
  if (env.CHATGPT_IMPORT_ENABLED !== "true")
    throw new ConvexError("Import integration disabled.");
  const principal = await ctx.runQuery(
    components.betterAuth.importGrants.resolve,
    {
      actorId: grant.actorId,
      clientId: grant.clientId,
      expiresAt: grant.expiresAt,
      verifiedAt: grant.verifiedAt,
    },
  );
  if (!principal)
    throw new ConvexError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Connect your account again.",
    });
  return principal;
}

/** Bounded operational projection; never returns provider URLs or workflow IDs. */
export const status = internalQuery({
  args: { grant: importGrant, jobId: v.id("testimonialImportJobs") },
  returns: v.object({
    jobId: v.id("testimonialImportJobs"),
    organizationSlug: v.string(),
    result: importResult,
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
    const principal = await requireImportPrincipal(ctx, args.grant);
    const job = await ctx.db.get(args.jobId);
    if (!job?.result) throw new ConvexError("Import unavailable.");
    const { organization } = await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
      principal,
    );
    const items = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (q) => q.eq("jobId", job._id))
      .take(500);
    return {
      jobId: job._id,
      organizationSlug: organization.slug,
      result: job.result,
      photos: items.flatMap((item) =>
        item.avatarStatus
          ? [
              {
                itemId: item._id,
                authorName:
                  item.identityCorrection?.authorName ?? item.authorName,
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
                authorName:
                  item.identityCorrection?.authorName ?? item.authorName,
                ...(item.videoStatus === "failed"
                  ? { failureMessage: safeImportFailure(item.failureReason) }
                  : {}),
                status: item.videoStatus,
              },
            ]
          : [],
      ),
    };
  },
});

function safeImportFailure(reason?: string): string {
  switch (reason) {
    case "The video could not be copied. Check the source and try again.":
      return "The source video could not be copied. Check that it is still available before retrying.";
    case "Video must be no longer than 2 minutes.":
      return "This video exceeds the 2-minute limit. Shorten it at the source before retrying.";
    case "Video reservation is no longer active.":
    case "Video reservation expired.":
    case "Video reservation expired. Upload the video again.":
    case "The video import was interrupted.":
      return "The copy was interrupted or timed out. Retry to start a new copy.";
    case "Video playback is unavailable.":
      return "The copied video could not be played. Retry the copy.";
    default:
      return "Video processing failed. Check the source video and try again.";
  }
}

export const retryPhoto = internalMutation({
  args: {
    grant: importGrant,
    jobId: v.id("testimonialImportJobs"),
    itemId: v.id("testimonialImportItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    retryOwnedImportAvatar(
      ctx,
      args.itemId,
      await requireImportPrincipal(ctx, args.grant),
      args.jobId,
    ),
});

export const retryVideo = internalMutation({
  args: {
    grant: importGrant,
    jobId: v.id("testimonialImportJobs"),
    itemId: v.id("testimonialImportItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    retryOwnedImportVideo(
      ctx,
      args.itemId,
      await requireImportPrincipal(ctx, args.grant),
      args.jobId,
    ),
});

export const destinations = internalQuery({
  args: {
    grant: v.object({
      actorId: v.string(),
      clientId: v.string(),
      issuedAt: v.number(),
      verifiedAt: v.number(),
      expiresAt: v.number(),
    }),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      videoCapacity: v.object({
        used: v.number(),
        limit: v.number(),
        available: v.boolean(),
        configured: v.boolean(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    if (env.CHATGPT_IMPORT_ENABLED !== "true")
      throw new ConvexError("Import integration disabled.");
    const principal = await ctx.runQuery(
      components.betterAuth.importGrants.resolve,
      {
        actorId: args.grant.actorId,
        clientId: args.grant.clientId,
        expiresAt: args.grant.expiresAt,
        verifiedAt: args.grant.verifiedAt,
      },
    );
    if (!principal)
      throw new ConvexError({
        code: "IMPORT_AUTH_REQUIRED",
        message: "Connect your account again.",
      });
    const destinations = await listImportDestinations(
      ctx,
      principal,
      args.paginationOpts,
    );
    return {
      ...destinations,
      page: await Promise.all(
        destinations.page.map(async (project) => ({
          ...project,
          videoCapacity: {
            ...(await getVideoStorageAvailability(ctx, project.id)),
            configured:
              env.MUX_PROVIDER === "mux" || env.MUX_PROVIDER === "fake",
          },
        })),
      ),
    };
  },
});

export const save = internalMutation({
  args: {
    grant: v.object({
      actorId: v.string(),
      clientId: v.string(),
      issuedAt: v.number(),
      verifiedAt: v.number(),
      expiresAt: v.number(),
    }),
    token: v.string(),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    jobId: v.id("testimonialImportJobs"),
    organizationSlug: v.string(),
    result: importResult,
  }),
  handler: async (ctx, args) => {
    if (env.CHATGPT_IMPORT_ENABLED !== "true")
      throw new ConvexError("Import integration disabled.");
    const principal = await ctx.runQuery(
      components.betterAuth.importGrants.resolve,
      {
        actorId: args.grant.actorId,
        clientId: args.grant.clientId,
        expiresAt: args.grant.expiresAt,
        verifiedAt: args.grant.verifiedAt,
      },
    );
    if (!principal)
      throw new ConvexError({
        code: "IMPORT_AUTH_REQUIRED",
        message: "Connect your account again.",
      });
    if (!/^[a-f0-9]{64}$/.test(args.token))
      throw new ConvexError("Preview unavailable.");
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    const { jobId } = await claimOwnedPreview(ctx, args, principal);
    const job = await ctx.db.get(jobId);
    const organization = await ctx.db.get(args.organizationId);
    if (!job || !organization) throw new ConvexError("Import unavailable.");
    if (!(await isProjectActive(ctx, organization)))
      throw new ConvexError("Choose an active Project for your import.");
    if (job.result)
      return { jobId, organizationSlug: organization.slug, result: job.result };
    // A claimed preview has cleared its anonymous payload; a previous website
    // claim instead keeps the selected IDs on the owned job.
    const positions = new Set(preview?.selectedPositions ?? []);
    const items = await ctx.db
      .query("testimonialImportItems")
      .withIndex("by_jobId_and_position", (q) => q.eq("jobId", jobId))
      .take(500);
    const itemIds = preview?.claimedBy
      ? (job.selectedItemIds ?? [])
      : items
          .filter((item) => positions.has(item.position))
          .map((item) => item._id);
    const result = await confirmOwnedImport(ctx, { jobId, itemIds }, principal);
    return { jobId, organizationSlug: organization.slug, result };
  },
});
