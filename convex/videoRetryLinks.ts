import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";

export async function createVideoRetryLink(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  token: { hash: string; seed: string },
) {
  if (!asset.testimonialId) return undefined;
  const deletion = await ctx.db
    .query("videoMediaDeletions")
    .withIndex("by_testimonial", (index) =>
      index.eq("testimonialId", asset.testimonialId!),
    )
    .unique();
  if (deletion) return undefined;
  const testimonial = await ctx.db.get(asset.testimonialId);
  const brand = testimonial
    ? await ctx.db.get(testimonial.organizationId)
    : null;
  if (!testimonial || !brand) return undefined;

  const oldLinks = await ctx.db
    .query("videoRetryLinks")
    .withIndex("by_video_asset", (index) => index.eq("videoAssetId", asset._id))
    .collect();
  const now = Date.now();
  const activeLink = oldLinks.find(
    (link) => !link.usedAt && link.expiresAt > now,
  );
  if (activeLink) {
    return {
      brandName: brand.name,
      email: testimonial.submitterEmail,
      retryLinkId: activeLink._id,
    };
  }
  for (const oldLink of oldLinks) {
    if (!oldLink.usedAt && oldLink.expiresAt > now) {
      await ctx.db.patch(oldLink._id, { expiresAt: now });
    }
  }
  const retryLinkId = await ctx.db.insert("videoRetryLinks", {
    createdAt: now,
    deliveryAttempts: 0,
    deliveryStatus: "pending",
    expiresAt: now + 24 * 60 * 60 * 1_000,
    organizationId: brand._id,
    testimonialId: testimonial._id,
    tokenHash: token.hash,
    tokenSeed: token.seed,
    videoAssetId: asset._id,
  });
  await ctx.scheduler.runAfter(0, internal.videoRetryDelivery.deliver, {
    retryLinkId,
  });
  return {
    brandName: brand.name,
    email: testimonial.submitterEmail,
    retryLinkId,
  };
}
