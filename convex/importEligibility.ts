import { ConvexError, v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  env,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getVideoStorageAvailability } from "./collectionQuotas";
import { isProjectActive } from "./projectActivity";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { findImportSource } from "./testimonialImports";
import {
  hasUnchangedImportContent,
  wallCandidate,
  wallProvider,
} from "./domain/testimonialImport";

export const eligibility = v.object({
  selected: v.number(),
  text: v.number(),
  video: v.number(),
  duplicates: v.number(),
  changed: v.number(),
  unavailable: v.number(),
  videoCapacityExceeded: v.number(),
  eligibleKeys: v.array(v.string()),
});

/** Advisory read only: confirmation still checks quota inside its transaction. */
export async function assessImportSelection(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  provider: Infer<typeof wallProvider>,
  sourceUrl: string,
  candidates: {
    key: string;
    item: Infer<typeof wallCandidate>;
    processed?: boolean;
  }[],
) {
  if (candidates.length > 100)
    throw new ConvexError("Select at most 100 testimonials.");
  const organization = await ctx.db.get(organizationId);
  const active = !!organization && (await isProjectActive(ctx, organization));
  const capacity = await getVideoStorageAvailability(ctx, organizationId);
  let videoPlaces =
    active &&
    capacity.available &&
    (env.MUX_PROVIDER === "mux" || env.MUX_PROVIDER === "fake")
      ? Math.max(0, capacity.limit - capacity.used)
      : 0;
  const result: Infer<typeof eligibility> = {
    selected: candidates.length,
    text: 0,
    video: 0,
    duplicates: 0,
    changed: 0,
    unavailable: 0,
    videoCapacityExceeded: 0,
    eligibleKeys: [],
  };
  const seen = new Set<string>();
  for (const { key, item, processed } of candidates) {
    if (
      !active ||
      item.unavailableReason ||
      (item.type === "video" && !item.videoUrl)
    ) {
      result.unavailable++;
      continue;
    }
    if (processed || seen.has(item.sourceId)) {
      result.duplicates++;
      continue;
    }
    seen.add(item.sourceId);
    const existing = await findImportSource(
      ctx,
      organizationId,
      provider,
      sourceUrl,
      item,
    );
    if (existing) {
      if (hasUnchangedImportContent(existing, item)) result.duplicates++;
      else result.changed++;
      continue;
    }
    if (item.type === "video") {
      if (!videoPlaces) {
        result.videoCapacityExceeded++;
        continue;
      }
      videoPlaces--;
      result.video++;
    } else result.text++;
    result.eligibleKeys.push(key);
  }
  return result;
}

export const selection = query({
  args: {
    jobId: v.id("testimonialImportJobs"),
    itemIds: v.array(v.id("testimonialImportItems")),
  },
  returns: eligibility,
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Import unavailable.");
    await requireOrganizationPermission(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
    );
    if (args.itemIds.length > 100)
      throw new ConvexError("Select at most 100 testimonials.");
    const candidates = [];
    for (const id of new Set(args.itemIds)) {
      const item = await ctx.db.get(id);
      if (!item || item.jobId !== job._id)
        throw new ConvexError("Select items from this preview.");
      candidates.push({
        key: String(id),
        item,
        processed: !!(item.outcome || item.videoStatus),
      });
    }
    return assessImportSelection(
      ctx,
      job.organizationId,
      job.provider,
      job.sourceUrl,
      candidates,
    );
  },
});
