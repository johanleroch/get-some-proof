import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
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
import { importResult } from "./domain/testimonialImport";

const rightsText =
  "I confirm that I have the rights to reuse the testimonials and customer media I import. Importing saves them privately as Pending and does not publish them.";

async function requirePaidAssistant(
  ctx: QueryCtx | MutationCtx,
  grant: ImportAccessGrant,
) {
  const principal = await requireImportPrincipal(ctx, grant);
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", principal.actorId))
    .unique();
  if (
    !account ||
    (await getAccountBillingEntitlement(ctx, account._id)).effectivePlan !==
      "premium"
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
    return {
      jobId: job._id,
      organizationSlug: organization.slug,
      result: job.result,
    };
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
        text: rightsText,
      });
    return null;
  },
});

export const submitText = internalMutation({
  args: {
    grant: importGrant,
    organizationId: v.optional(v.id("organizations")),
    sourceUrl: v.string(),
    sourceId: v.string(),
    authorName: v.string(),
    text: v.string(),
  },
  returns: v.object({
    jobId: v.id("testimonialImportJobs"),
    organizationSlug: v.string(),
    result: importResult,
  }),
  handler: async (ctx, args) => {
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
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      organizationId,
    );
    if (entitlement.effectivePlan !== "premium")
      throw new ConvexError("Pro is required for assistant imports.");
    const activation = await ctx.db
      .query("assistantImportActivations")
      .withIndex("by_actorId", (q) => q.eq("actorId", principal.actorId))
      .unique();
    if (!activation)
      throw new ConvexError(
        "Confirm your reuse rights on the MCP setup screen before importing.",
      );
    let source: URL;
    try {
      source = new URL(args.sourceUrl);
    } catch {
      throw new ConvexError("Provide a public source page URL.");
    }
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.username ||
      source.password ||
      args.sourceUrl.length > 2048
    )
      throw new ConvexError(
        "Provide a public source page URL without credentials.",
      );
    if (
      !args.sourceId.trim() ||
      args.sourceId.length > 200 ||
      !args.authorName.trim() ||
      args.authorName.length > 100 ||
      !args.text.trim() ||
      args.text.length > 10_000
    )
      throw new ConvexError(
        "Provide bounded original text, source identity and author name.",
      );
    const now = Date.now();
    const jobId = await ctx.db.insert("testimonialImportJobs", {
      organizationId,
      createdBy: principal.actorId,
      provider: "assistant",
      sourceUrl: source.href,
      itemCount: 1,
      createdAt: now,
      expiresAt: now + 86400_000,
    });
    const itemId = await ctx.db.insert("testimonialImportItems", {
      organizationId,
      jobId,
      position: 0,
      sourceId: args.sourceId,
      authorName: args.authorName,
      text: args.text,
      type: "text",
    });
    const result = await confirmOwnedImport(
      ctx,
      { jobId, itemIds: [itemId] },
      principal,
    );
    return { jobId, organizationSlug: organization.slug, result };
  },
});
