import type { Id } from "./_generated/dataModel";
import { beginImportFlow, recordImportStage } from "./importAcquisition";
import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { authzForOrganization } from "./authorization";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  normalizeImportIdentity,
  wallCandidate,
  wallProvider,
} from "./domain/testimonialImport";
import { hashSubmissionManagementToken } from "./domain/submission";
import { persistOwnedPreview } from "./testimonialImports";
import {
  requireOrganizationPermission,
  requireOrganizationPermissionForPrincipal,
} from "./security/organizationAccess";
import { isProjectActive } from "./projectActivity";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";

const limiter = new RateLimiter(components.rateLimiter, {
  anonymousWallReads: { kind: "fixed window", rate: 50, period: HOUR },
});

function unavailable(): never {
  throw new ConvexError({
    code: "PREVIEW_UNAVAILABLE",
    message: "This preview is no longer available. Read your wall again.",
  });
}

export const destinations = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({ id: v.id("organizations"), name: v.string(), slug: v.string() }),
  ),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    return listImportDestinations(ctx, principal, args.paginationOpts);
  },
});
export async function listImportDestinations(
  ctx: QueryCtx,
  principal: Principal,
  paginationOpts: { numItems: number; cursor: string | null },
) {
  if (paginationOpts.numItems > 20)
    throw new ConvexError({
      code: "INVALID_PAGE_SIZE",
      message: "Request at most 20 Projects.",
    });
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", principal.actorId).eq("status", "active"),
    )
    .paginate(paginationOpts);
  const projects = await Promise.all(
    memberships.page.map(async (membership) => {
      const project = await ctx.db.get(membership.organizationId);
      if (
        !project ||
        !(await isProjectActive(ctx, project)) ||
        !(await authzForOrganization(String(project._id)).can(
          ctx,
          principal.actorId,
          "ownership:manage",
        ))
      )
        return null;
      return { id: project._id, name: project.name, slug: project.slug };
    }),
  );
  return {
    ...memberships,
    page: projects.filter((project) => project !== null),
  };
}

async function tokenHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) unavailable();
  return hashSubmissionManagementToken(token);
}

export const authorize = internalMutation({
  args: {
    channel: v.optional(v.union(v.literal("public-web"), v.literal("chatgpt"))),
  },
  returns: v.id("importAcquisitionFlows"),
  handler: async (ctx, args) => {
    if (!(await limiter.limit(ctx, "anonymousWallReads")).ok)
      throw new ConvexError({
        code: "IMPORT_RATE_LIMITED",
        message: "Public previews are busy. Try again later.",
      });
    return beginImportFlow(ctx, args.channel ?? "public-web");
  },
});

export const store = internalMutation({
  args: {
    acquisitionFlowId: v.optional(v.id("importAcquisitionFlows")),
    tokenHash: v.string(),
    provider: wallProvider,
    sourceUrl: v.string(),
    items: v.array(wallCandidate),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      args.items.length > 500 ||
      new TextEncoder().encode(JSON.stringify(args.items)).byteLength > 500_000
    )
      throw new ConvexError({
        code: "WALL_TOO_LARGE",
        message: "This wall exceeds the preview capacity.",
      });
    await recordImportStage(ctx, args.acquisitionFlowId, "previewed");
    const previewId = await ctx.db.insert("anonymousWallPreviews", {
      ...args,
      selectedPositions: [],
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * HOUR,
    });
    await ctx.scheduler.runAfter(
      24 * HOUR,
      internal.anonymousWallImports.expire,
      { previewId },
    );
    return null;
  },
});

export const expire = internalMutation({
  args: { previewId: v.id("anonymousWallPreviews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await ctx.db.get(args.previewId)) await ctx.db.delete(args.previewId);
    return null;
  },
});

export const read = query({
  args: {
    token: v.string(),
    offset: v.number(),
    type: v.optional(v.union(v.literal("text"), v.literal("video"))),
  },
  returns: v.union(
    v.null(),
    v.object({
      provider: wallProvider,
      sourceUrl: v.string(),
      itemCount: v.number(),
      expiresAt: v.number(),
      selectedPositions: v.array(v.number()),
      items: v.array(
        v.object({ position: v.number(), ...wallCandidate.fields }),
      ),
      nextOffset: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.token)) return null;
    const hash = await tokenHash(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .unique();
    // Scheduled removal provides reactive expiry; expired actions also check time.
    if (!preview || preview.claimedBy) return null;
    if (
      !Number.isSafeInteger(args.offset) ||
      args.offset < 0 ||
      args.offset > 500
    )
      unavailable();
    const candidates = preview.items
      .map((item, position) => {
        const correction = preview.identityCorrections?.find(
          (value) => value.position === position,
        );
        return {
          ...item,
          position,
          ...(correction
            ? { authorName: correction.authorName, tagline: correction.tagline }
            : {}),
        };
      })
      .filter((item) => !args.type || item.type === args.type);
    return {
      provider: preview.provider,
      sourceUrl: preview.sourceUrl,
      itemCount: preview.items.length,
      expiresAt: preview.expiresAt,
      selectedPositions: preview.selectedPositions,
      items: await Promise.all(
        candidates
          .slice(args.offset, args.offset + 100)
          .map(async (item): Promise<typeof item> => {
            const correction = preview.identityCorrections?.find(
              (c) => c.position === item.position,
            );
            return {
              ...item,
              avatarUrl:
                correction?.avatarStorageId === undefined
                  ? item.avatarUrl
                  : correction.avatarStorageId
                    ? ((await ctx.storage.getUrl(correction.avatarStorageId)) ??
                      undefined)
                    : undefined,
            };
          }),
      ),
      nextOffset:
        args.offset + 100 < candidates.length ? args.offset + 100 : null,
    };
  },
});

export const select = mutation({
  args: { token: v.string(), positions: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const hash = await tokenHash(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (!preview || preview.claimedBy || preview.expiresAt <= Date.now())
      unavailable();
    const positions = [...new Set(args.positions)];
    if (
      positions.length > 100 ||
      positions.some(
        (position) =>
          !Number.isSafeInteger(position) ||
          position < 0 ||
          position >= preview.items.length ||
          preview.items[position]!.unavailableReason,
      )
    )
      throw new ConvexError({
        code: "INVALID_SELECTION",
        message: "Select at most 100 available testimonials.",
      });
    await ctx.db.patch(preview._id, { selectedPositions: positions });
    return null;
  },
});

/** The preview capability permits editing this snapshot only, never an Account. */
export const correctIdentity = mutation({
  args: {
    token: v.string(),
    position: v.number(),
    authorName: v.string(),
    tagline: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const hash = await tokenHash(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (!preview || preview.claimedBy || preview.expiresAt <= Date.now())
      unavailable();
    if (
      !Number.isSafeInteger(args.position) ||
      args.position < 0 ||
      args.position >= preview.items.length ||
      preview.items[args.position]!.unavailableReason
    )
      unavailable();
    const identity = normalizeImportIdentity(args);
    const avatarStorageId = preview.identityCorrections?.find(
      (value) => value.position === args.position,
    )?.avatarStorageId;
    const corrections = (preview.identityCorrections ?? []).filter(
      (value) => value.position !== args.position,
    );
    corrections.push({
      avatarStorageId,
      position: args.position,
      ...identity,
      editedAt: Date.now(),
    });
    await ctx.db.patch(preview._id, { identityCorrections: corrections });
    return null;
  },
});

/** Recover a claim even when the browser lost its successful response. */
export const resume = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("testimonialImportJobs"),
      organizationSlug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (
      !/^[a-f0-9]{64}$/.test(args.token) ||
      !(await ctx.auth.getUserIdentity())
    )
      return null;
    const principal = await requireVerifiedPrincipal(ctx);
    const hash = await tokenHash(args.token);
    const preview = await ctx.db
      .query("anonymousWallPreviews")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (
      !preview?.claimedJobId ||
      !preview.claimedOrganizationId ||
      preview.claimedBy !== principal.actorId
    )
      return null;
    const { organization } = await requireOrganizationPermission(
      ctx,
      { organizationId: preview.claimedOrganizationId },
      "ownership:manage",
    );
    if (!(await ctx.db.get(preview.claimedJobId))) return null;
    return { jobId: preview.claimedJobId, organizationSlug: organization.slug };
  },
});

/** Authenticated claim and destination snapshot are committed together; no import or publication yet. */
export const claim = mutation({
  args: { token: v.string(), organizationId: v.id("organizations") },
  returns: v.object({ jobId: v.id("testimonialImportJobs") }),
  handler: (ctx, args) => claimOwnedPreview(ctx, args),
});

export async function claimOwnedPreview(
  ctx: MutationCtx,
  args: { token: string; organizationId: Id<"organizations"> },
  verifiedPrincipal?: Principal,
) {
  const { principal, organization } =
    await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
      verifiedPrincipal ?? (await requireVerifiedPrincipal(ctx)),
    );
  const hash = await tokenHash(args.token);
  const preview = await ctx.db
    .query("anonymousWallPreviews")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
    .unique();
  if (!preview || preview.expiresAt <= Date.now()) unavailable();
  if (preview.claimedBy) {
    if (
      preview.claimedBy !== principal.actorId ||
      preview.claimedOrganizationId !== args.organizationId ||
      !preview.claimedJobId
    )
      unavailable();
    return { jobId: preview.claimedJobId };
  }
  if (!(await isProjectActive(ctx, organization)))
    throw new ConvexError({
      code: "PROJECT_INACTIVE",
      message: "Choose an active Project for your import.",
    });
  const result = await persistOwnedPreview(
    ctx,
    {
      organizationId: args.organizationId,
      acquisitionFlowId: preview.acquisitionFlowId,
      provider: preview.provider,
      sourceUrl: preview.sourceUrl,
      items: preview.items,
    },
    principal,
  );
  const items = await ctx.db
    .query("testimonialImportItems")
    .withIndex("by_jobId_and_position", (q) => q.eq("jobId", result.jobId))
    .take(500);
  for (const item of items) {
    const correction = preview.identityCorrections?.find(
      (value) => value.position === item.position,
    );
    if (correction && item.sourceState === "new" && !item.unavailableReason) {
      if (correction.avatarStorageId) {
        const upload = await ctx.db
          .query("importAvatarUploads")
          .withIndex("by_storage_id", (q) =>
            q.eq("storageId", correction.avatarStorageId!),
          )
          .unique();
        const job = await ctx.db.get(result.jobId);
        if (upload && job)
          await ctx.db.patch(upload._id, { expiresAt: job.expiresAt });
      }
      await ctx.db.patch(item._id, {
        identityCorrection: {
          avatarStorageId: correction.avatarStorageId,
          authorName: correction.authorName,
          tagline: correction.tagline,
          editedAt: correction.editedAt,
          editedBy: principal.actorId,
        },
      });
    }
  }
  const selected = new Set(preview.selectedPositions);
  await ctx.db.patch(result.jobId, {
    selectedItemIds: items
      .filter(
        (item) =>
          selected.has(item.position) &&
          item.sourceState === "new" &&
          !item.unavailableReason,
      )
      .map((item) => item._id),
  });
  await recordImportStage(ctx, preview.acquisitionFlowId, "claimed");
  await ctx.db.patch(preview._id, {
    claimedBy: principal.actorId,
    claimedJobId: result.jobId,
    claimedOrganizationId: args.organizationId,
    items: [],
    identityCorrections: undefined,
    selectedPositions: [],
  });
  return result;
}
