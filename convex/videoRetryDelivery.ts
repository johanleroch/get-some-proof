import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { deriveVideoRetryToken } from "./domain/video";
import { hashSubmissionManagementToken } from "./domain/submission";
import { sendTransactionalEmail } from "./email/provider";
import { buildVideoRetryEmail } from "./email/templates";

const deliveryLeaseMs = 5 * 60 * 1_000;
const maximumDeliveryAttempts = 5;

export const claim = internalMutation({
  args: {
    leaseId: v.string(),
    retryLinkId: v.id("videoRetryLinks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      attempt: v.number(),
      brandName: v.string(),
      email: v.string(),
      tokenHash: v.string(),
      tokenSeed: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.retryLinkId);
    const now = Date.now();
    if (
      !link ||
      link.usedAt ||
      link.expiresAt <= now ||
      link.deliveredAt ||
      !link.tokenSeed ||
      (link.deliveryAttempts ?? 0) >= maximumDeliveryAttempts ||
      (link.deliveryLeaseExpiresAt && link.deliveryLeaseExpiresAt > now)
    ) {
      return null;
    }
    const [testimonial, brand] = await Promise.all([
      ctx.db.get(link.testimonialId),
      ctx.db.get(link.organizationId),
    ]);
    if (!testimonial || !brand) return null;
    const attempt = (link.deliveryAttempts ?? 0) + 1;
    await ctx.db.patch(link._id, {
      deliveryAttempts: attempt,
      deliveryError: undefined,
      deliveryLeaseExpiresAt: now + deliveryLeaseMs,
      deliveryLeaseId: args.leaseId,
      deliveryStatus: "pending",
    });
    await ctx.scheduler.runAfter(
      deliveryLeaseMs,
      internal.videoRetryDelivery.deliver,
      { retryLinkId: link._id },
    );
    return {
      attempt,
      brandName: brand.name,
      email: testimonial.submitterEmail,
      tokenHash: link.tokenHash,
      tokenSeed: link.tokenSeed,
    };
  },
});

export const record = internalMutation({
  args: {
    error: v.optional(v.string()),
    leaseId: v.string(),
    retryLinkId: v.id("videoRetryLinks"),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.retryLinkId);
    if (!link || link.deliveryLeaseId !== args.leaseId) return null;
    await ctx.db.patch(link._id, {
      deliveredAt: args.status === "sent" ? Date.now() : undefined,
      deliveryError: args.error,
      deliveryLeaseExpiresAt: undefined,
      deliveryLeaseId: undefined,
      deliveryStatus: args.status,
    });
    return null;
  },
});

export const deliver = internalAction({
  args: { retryLinkId: v.id("videoRetryLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaseId = crypto.randomUUID();
    const delivery = await ctx.runMutation(internal.videoRetryDelivery.claim, {
      leaseId,
      retryLinkId: args.retryLinkId,
    });
    if (!delivery) return null;

    try {
      const secret = process.env.VIDEO_WEBHOOK_INGEST_SECRET;
      if (!secret) throw new Error("Video retry delivery is not configured.");
      const token = await deriveVideoRetryToken(secret, delivery.tokenSeed);
      if ((await hashSubmissionManagementToken(token)) !== delivery.tokenHash) {
        throw new Error("Video retry token integrity check failed.");
      }
      const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(
        /\/$/,
        "",
      );
      await sendTransactionalEmail({
        ...buildVideoRetryEmail({
          brandName: delivery.brandName,
          email: delivery.email,
          url: `${siteUrl}/retry-video/${encodeURIComponent(token)}`,
        }),
        idempotencyKey: `video-retry-${String(args.retryLinkId)}`,
      });
      await ctx.runMutation(internal.videoRetryDelivery.record, {
        leaseId,
        retryLinkId: args.retryLinkId,
        status: "sent",
      });
    } catch (error) {
      await ctx.runMutation(internal.videoRetryDelivery.record, {
        error:
          error instanceof Error
            ? error.message.slice(0, 200)
            : "Video retry delivery failed.",
        leaseId,
        retryLinkId: args.retryLinkId,
        status: "failed",
      });
      if (delivery.attempt < maximumDeliveryAttempts) {
        const delayMs = Math.min(
          30_000 * 2 ** (delivery.attempt - 1),
          15 * 60_000,
        );
        await ctx.scheduler.runAfter(
          delayMs,
          internal.videoRetryDelivery.deliver,
          args,
        );
      }
    }
    return null;
  },
});
