import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";

export const freeTextCreditLimit = 13;
export const freeVideoCreditLimit = 2;
export const premiumReadyVideoLimit = 25;
const automaticSpamRestorationWindowMs = 30 * 24 * 60 * 60 * 1_000;
const automaticSpamRestorationLimit = 3;

type DatabaseCtx = QueryCtx | MutationCtx;
type SubmissionType = "text" | "video";

async function activeCreditCount(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
  submissionType: SubmissionType,
) {
  const credits = await ctx.db
    .query("collectionCredits")
    .withIndex("by_organization_type", (index) =>
      index
        .eq("organizationId", organizationId)
        .eq("submissionType", submissionType),
    )
    .collect();
  return credits.filter((credit) => credit.restoredAt === undefined).length;
}

async function liveReservationCount(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
) {
  const reservations = await ctx.db
    .query("videoReservations")
    .withIndex("by_organization_status", (index) =>
      index.eq("organizationId", organizationId).eq("status", "reserved"),
    )
    .collect();
  const now = Date.now();
  return reservations.filter((reservation) => reservation.expiresAt > now)
    .length;
}

async function unledgeredConsumedFreeVideoCount(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
) {
  const reservations = await ctx.db
    .query("videoReservations")
    .withIndex("by_organization_status", (index) =>
      index.eq("organizationId", organizationId).eq("status", "consumed"),
    )
    .collect();
  const candidates = reservations.filter(({ plan }) => plan === "free");
  const unledgered = await Promise.all(
    candidates.map(async (reservation) => {
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_reservation", (index) =>
          index.eq("reservationId", reservation._id),
        )
        .unique();
      if (!asset?.testimonialId) return true;
      const credit = await ctx.db
        .query("collectionCredits")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", asset.testimonialId!),
        )
        .unique();
      return credit === null;
    }),
  );
  return unledgered.filter(Boolean).length;
}

export async function getCollectionAvailability(
  ctx: DatabaseCtx,
  organizationId: Id<"organizations">,
) {
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  const reservations = await liveReservationCount(ctx, organizationId);
  if (entitlement.effectivePlan === "free") {
    const [textUsed, videoUsed, unledgeredVideo] = await Promise.all([
      activeCreditCount(ctx, organizationId, "text"),
      activeCreditCount(ctx, organizationId, "video"),
      unledgeredConsumedFreeVideoCount(ctx, organizationId),
    ]);
    return {
      textAvailable: textUsed < freeTextCreditLimit,
      videoAvailable:
        videoUsed + unledgeredVideo + reservations < freeVideoCreditLimit,
    };
  }
  const readyVideos = await ctx.db
    .query("videoAssets")
    .withIndex("by_organization_status", (index) =>
      index.eq("organizationId", organizationId).eq("status", "ready"),
    )
    .collect();
  return {
    textAvailable: true,
    videoAvailable: readyVideos.length + reservations < premiumReadyVideoLimit,
  };
}

export async function consumeFreeCollectionCredit(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    plan: "free" | "premium";
    submissionType: SubmissionType;
    testimonialId: Id<"testimonials">;
  },
) {
  if (input.plan !== "free") return null;
  const existing = await ctx.db
    .query("collectionCredits")
    .withIndex("by_testimonial", (index) =>
      index.eq("testimonialId", input.testimonialId),
    )
    .unique();
  if (existing) return existing._id;
  const used = await activeCreditCount(
    ctx,
    input.organizationId,
    input.submissionType,
  );
  const limit =
    input.submissionType === "text"
      ? freeTextCreditLimit
      : freeVideoCreditLimit;
  if (used >= limit) {
    throw new ConvexError({
      code: "COLLECTION_TYPE_UNAVAILABLE",
      message: "This testimonial format is temporarily unavailable.",
    });
  }
  return await ctx.db.insert("collectionCredits", {
    consumedAt: Date.now(),
    organizationId: input.organizationId,
    submissionType: input.submissionType,
    testimonialId: input.testimonialId,
  });
}

export async function consumeReadyVideoCredit(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    plan: "free" | "premium";
    testimonialId: Id<"testimonials">;
  },
) {
  const creditId = await consumeFreeCollectionCredit(ctx, {
    ...input,
    submissionType: "video",
  });
  if (!creditId) return null;
  const testimonial = await ctx.db.get(input.testimonialId);
  if (testimonial?.moderationStatus !== "spam") return creditId;
  const quarantine = await ctx.db
    .query("spamQuarantines")
    .withIndex("by_testimonial", (index) =>
      index.eq("testimonialId", input.testimonialId),
    )
    .order("desc")
    .first();
  if (!quarantine || quarantine.status !== "active") return creditId;
  if (quarantine.creditRestored) return creditId;
  const now = Date.now();
  const recentReports = await ctx.db
    .query("spamQuarantines")
    .withIndex("by_organization_reported_at", (index) =>
      index
        .eq("organizationId", input.organizationId)
        .gte("reportedAt", now - automaticSpamRestorationWindowMs),
    )
    .collect();
  const automaticRestorations = recentReports.filter(
    (report) =>
      report._id !== quarantine._id && report.restorationMode === "automatic",
  ).length;
  if (automaticRestorations >= automaticSpamRestorationLimit) return creditId;
  await ctx.db.patch(creditId, {
    restorationMode: "automatic",
    restoredAt: now,
  });
  await ctx.db.patch(quarantine._id, {
    creditRestored: true,
    restorationMode: "automatic",
    updatedAt: now,
  });
  return creditId;
}

export const getPublicAvailability = query({
  args: { publicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({ textAvailable: v.boolean(), videoAvailable: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", args.publicSlug.trim().toLowerCase()),
      )
      .unique();
    if (!organization) return null;
    return await getCollectionAvailability(ctx, organization._id);
  },
});
