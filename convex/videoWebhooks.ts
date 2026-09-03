import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { hashSubmissionManagementToken } from "./domain/submission";
import { deriveVideoRetryToken } from "./domain/video";
import { createVideoRetryLink } from "./videoRetryLinks";
import { consumeReadyVideoCredit } from "./collectionQuotas";

const eventValidator = v.object({
  data: v.any(),
  id: v.string(),
  type: v.string(),
});

type VideoEvent = {
  data: unknown;
  id: string;
  type: string;
};

type EventData = {
  asset_id?: unknown;
  duration?: unknown;
  id?: unknown;
  passthrough?: unknown;
  playback_ids?: unknown;
};

function eventData(value: unknown): EventData {
  return value && typeof value === "object" ? (value as EventData) : {};
}

async function findAsset(
  ctx: MutationCtx,
  event: VideoEvent,
): Promise<Doc<"videoAssets"> | null> {
  const data = eventData(event.data);
  const isUploadEvent = event.type.startsWith("video.upload.");
  const isTrackEvent = event.type.startsWith("video.asset.track.");
  const providerId = isTrackEvent
    ? typeof data.asset_id === "string"
      ? data.asset_id
      : undefined
    : typeof data.id === "string"
      ? data.id
      : typeof data.asset_id === "string"
        ? data.asset_id
        : undefined;
  if (providerId) {
    const indexed = isUploadEvent
      ? await ctx.db
          .query("videoAssets")
          .withIndex("by_provider_upload_id", (index) =>
            index.eq("providerUploadId", providerId),
          )
          .unique()
      : await ctx.db
          .query("videoAssets")
          .withIndex("by_provider_asset_id", (index) =>
            index.eq("providerAssetId", providerId),
          )
          .unique();
    if (indexed) return indexed;
  }
  if (typeof data.passthrough !== "string") return null;
  const reservationId = ctx.db.normalizeId(
    "videoReservations",
    data.passthrough,
  );
  if (!reservationId) return null;
  return await ctx.db
    .query("videoAssets")
    .withIndex("by_reservation", (index) =>
      index.eq("reservationId", reservationId),
    )
    .unique();
}

function publicPlaybackId(data: EventData) {
  if (!Array.isArray(data.playback_ids)) return undefined;
  const playback = data.playback_ids.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      (candidate as { policy?: unknown }).policy === "public" &&
      typeof (candidate as { id?: unknown }).id === "string",
  ) as { id: string } | undefined;
  return playback?.id;
}

async function failAsset(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  reason: string,
) {
  if (asset.status === "ready" || asset.status === "failed") return false;
  await ctx.db.patch(asset._id, {
    failureReason: reason.slice(0, 200),
    status: "failed",
    updatedAt: Date.now(),
  });
  const reservation = await ctx.db.get(asset.reservationId);
  if (reservation?.status === "reserved") {
    await ctx.db.patch(reservation._id, {
      status: "released",
      updatedAt: Date.now(),
    });
  }
  return true;
}

export const applyEvent = internalMutation({
  args: {
    event: eventValidator,
    retryTokenHash: v.string(),
    retryTokenSeed: v.string(),
  },
  returns: v.object({ outcome: v.string() }),
  handler: async (ctx, { event, retryTokenHash, retryTokenSeed }) => {
    if (
      !event.id ||
      event.id.length > 200 ||
      !event.type ||
      event.type.length > 100
    ) {
      throw new ConvexError({
        code: "INVALID_VIDEO_EVENT",
        message: "Video event is invalid.",
      });
    }
    const duplicate = await ctx.db
      .query("videoWebhookEvents")
      .withIndex("by_provider_event_id", (index) =>
        index.eq("providerEventId", event.id),
      )
      .unique();
    if (duplicate) return { outcome: "duplicate" };

    const asset = await findAsset(ctx, event);
    const data = eventData(event.data);
    let outcome = "ignored";
    if (asset) {
      if (event.type === "video.upload.asset_created") {
        if (asset.status === "awaiting_upload") {
          await ctx.db.patch(asset._id, {
            providerAssetId:
              typeof data.asset_id === "string"
                ? data.asset_id
                : asset.providerAssetId,
            status: "processing",
            updatedAt: Date.now(),
          });
          outcome = "processing";
        } else {
          outcome = `already_${asset.status}`;
        }
      } else if (
        event.type === "video.upload.cancelled" ||
        event.type === "video.upload.errored" ||
        event.type === "video.asset.errored"
      ) {
        const failedNow = await failAsset(
          ctx,
          asset,
          "Video processing failed.",
        );
        outcome = asset.status === "ready" ? "already_ready" : "failed";
        if ((failedNow || asset.status === "failed") && asset.testimonialId) {
          await createVideoRetryLink(ctx, asset, {
            hash: retryTokenHash,
            seed: retryTokenSeed,
          });
        }
      } else if (event.type === "video.asset.ready") {
        const reservation = await ctx.db.get(asset.reservationId);
        if (asset.status === "ready") {
          outcome = "already_ready";
        } else if (
          !reservation ||
          reservation.status !== "reserved" ||
          reservation.expiresAt <= Date.now()
        ) {
          const failedNow = await failAsset(
            ctx,
            asset,
            "Video reservation is no longer active.",
          );
          if (failedNow && asset.testimonialId) {
            await createVideoRetryLink(ctx, asset, {
              hash: retryTokenHash,
              seed: retryTokenSeed,
            });
          }
          outcome = "released";
        } else if (
          typeof data.duration !== "number" ||
          !Number.isFinite(data.duration) ||
          data.duration <= 0 ||
          data.duration > 120
        ) {
          const failedNow = await failAsset(
            ctx,
            asset,
            "Video must be no longer than 2 minutes.",
          );
          if (failedNow && asset.testimonialId) {
            await createVideoRetryLink(ctx, asset, {
              hash: retryTokenHash,
              seed: retryTokenSeed,
            });
          }
          outcome = "failed";
        } else {
          const playbackId = publicPlaybackId(data);
          if (!playbackId) {
            const failedNow = await failAsset(
              ctx,
              asset,
              "Video playback is unavailable.",
            );
            if (failedNow && asset.testimonialId) {
              await createVideoRetryLink(ctx, asset, {
                hash: retryTokenHash,
                seed: retryTokenSeed,
              });
            }
            outcome = "failed";
          } else {
            await ctx.db.patch(asset._id, {
              durationSeconds: data.duration,
              playbackId,
              providerAssetId:
                typeof data.id === "string" ? data.id : asset.providerAssetId,
              status: "ready",
              updatedAt: Date.now(),
            });
            await ctx.db.patch(reservation._id, {
              status: "consumed",
              updatedAt: Date.now(),
            });
            if (asset.testimonialId) {
              await consumeReadyVideoCredit(ctx, {
                organizationId: reservation.organizationId,
                plan: reservation.plan,
                testimonialId: asset.testimonialId,
              });
            }
            outcome = "ready";
          }
        }
      } else if (
        event.type === "video.asset.track.ready" ||
        event.type === "video.asset.track.errored"
      ) {
        const captionsAvailable = event.type === "video.asset.track.ready";
        await ctx.db.patch(asset._id, {
          captionsStatus: captionsAvailable ? "ready" : "failed",
          updatedAt: Date.now(),
        });
        if (asset.testimonialId) {
          const testimonialId = asset.testimonialId;
          const projection = await ctx.db
            .query("publicTestimonialProjections")
            .withIndex("by_testimonial", (index) =>
              index.eq("testimonialId", testimonialId),
            )
            .unique();
          if (projection?.type === "video") {
            await ctx.db.patch(projection._id, { captionsAvailable });
          }
        }
        outcome = captionsAvailable ? "captions_ready" : "captions_failed";
      }
    }
    await ctx.db.insert("videoWebhookEvents", {
      eventType: event.type,
      outcome,
      processedAt: Date.now(),
      providerEventId: event.id,
    });
    return { outcome };
  },
});

export const ingest = action({
  args: { event: eventValidator, ingestSecret: v.string() },
  returns: v.object({ outcome: v.string() }),
  handler: async (ctx, args): Promise<{ outcome: string }> => {
    const expected = process.env.VIDEO_WEBHOOK_INGEST_SECRET;
    if (!expected || expected.length < 32 || args.ingestSecret !== expected) {
      throw new ConvexError({
        code: "VIDEO_WEBHOOK_UNAUTHORIZED",
        message: "Video webhook unauthorized.",
      });
    }
    const retryTokenSeed = `webhook:${args.event.id}`;
    const retryToken = await deriveVideoRetryToken(
      args.ingestSecret,
      retryTokenSeed,
    );
    const result: { outcome: string } = await ctx.runMutation(
      internal.videoWebhooks.applyEvent,
      {
        event: args.event,
        retryTokenHash: await hashSubmissionManagementToken(retryToken),
        retryTokenSeed,
      },
    );
    return { outcome: result.outcome };
  },
});
