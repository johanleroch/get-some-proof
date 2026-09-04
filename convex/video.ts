import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  type ActionCtx,
  type MutationCtx,
  query,
} from "./_generated/server";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { authzForOrganization } from "./authorization";
import {
  consumeReadyVideoCredit,
  getCollectionAvailability,
} from "./collectionQuotas";
import {
  assertVideoMetadata,
  deriveVideoRetryToken,
  normalizeVideoMimeType,
  supportedVideoMimeTypes,
  type VideoPlan,
} from "./domain/video";
import {
  assertPublicationConsentSnapshot,
  buildPublicationConsent,
  buildSubmissionEmailIdempotencyKey,
  hashSubmissionManagementToken,
  randomSubmissionManagementToken,
} from "./domain/submission";
import {
  sendTransactionalEmail,
  UncertainEmailDeliveryError,
} from "./email/provider";
import {
  buildNewPendingTestimonialEmail,
  buildVideoSubmissionConfirmationEmail,
} from "./email/templates";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import { requireOrganizationPermission } from "./security/organizationAccess";
import {
  cancelVideoDirectUpload,
  createVideoDirectUpload,
  type DirectUpload,
} from "./videoProvider";
import { createVideoRetryLink } from "./videoRetryLinks";
import { verifyTurnstileToken } from "./turnstile";

const reservationTtlMs = 2 * 60 * 60 * 1_000;
const maximumVideoFileBytes = 512 * 1024 * 1024;
const emailAttemptLeaseMs = 5 * 60 * 1_000;

function unavailable(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

async function requireOpenVideoOrganization(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  if (!organization || organization.deletionStartedAt !== undefined) {
    unavailable("COLLECTION_FORM_UNAVAILABLE", "Collection Form unavailable.");
  }
  return organization;
}

function normalizedClientSubmissionId(value: string) {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(normalized)) {
    unavailable(
      "INVALID_VIDEO_SUBMISSION",
      "Video upload could not be started. Refresh and try again.",
    );
  }
  return normalized;
}

function validateUploadRequest(mimeType: string, fileSizeBytes: number) {
  const normalizedMimeType = normalizeVideoMimeType(mimeType);
  if (
    !(supportedVideoMimeTypes as readonly string[]).includes(normalizedMimeType)
  ) {
    unavailable("UNSUPPORTED_VIDEO", "Choose an MP4, MOV or WebM video.");
  }
  if (
    !Number.isSafeInteger(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > maximumVideoFileBytes
  ) {
    unavailable("INVALID_VIDEO_SIZE", "Choose a video smaller than 512 MB.");
  }
  return normalizedMimeType;
}

async function reserveForOrganization(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  requestedClientSubmissionId: string,
) {
  await requireOpenVideoOrganization(ctx, organizationId);
  const clientSubmissionId = normalizedClientSubmissionId(
    requestedClientSubmissionId,
  );
  const existing = await ctx.db
    .query("videoReservations")
    .withIndex("by_organization_client_submission", (index) =>
      index
        .eq("organizationId", organizationId)
        .eq("clientSubmissionId", clientSubmissionId),
    )
    .unique();
  if (existing?.status === "reserved" && existing.expiresAt > Date.now()) {
    unavailable(
      "VIDEO_UPLOAD_ALREADY_RESERVED",
      "This browser submission already has a video upload.",
    );
  }
  if (existing?.status === "consumed") {
    unavailable(
      "VIDEO_CREDIT_ALREADY_USED",
      "This browser submission already used a video credit.",
    );
  }

  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  if (entitlement.state === "past_due") {
    unavailable(
      "PAYMENT_GRACE_VIDEO_BLOCKED",
      "New video storage is paused until the payment method is updated.",
    );
  }
  const plan = entitlement.effectivePlan as VideoPlan;
  const availability = await getCollectionAvailability(ctx, organizationId);
  const now = Date.now();
  if (!availability.videoAvailable) {
    unavailable(
      "VIDEO_CAPACITY_REACHED",
      "Video testimonials are temporarily unavailable for this Brand.",
    );
  }
  const expiresAt = now + reservationTtlMs;
  if (existing) {
    const previousAsset = await ctx.db
      .query("videoAssets")
      .withIndex("by_reservation", (index) =>
        index.eq("reservationId", existing._id),
      )
      .unique();
    if (previousAsset?.testimonialId) {
      unavailable(
        "VIDEO_RETRY_REQUIRED",
        "Use the private replacement link sent by email.",
      );
    }
    if (previousAsset) await ctx.db.delete(previousAsset._id);
    await ctx.db.delete(existing._id);
  }
  const reservationId = await ctx.db.insert("videoReservations", {
    clientSubmissionId,
    createdAt: now,
    expiresAt,
    organizationId,
    plan,
    status: "reserved",
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(
    reservationTtlMs,
    internal.video.expireReservation,
    { reservationId },
  );
  return { expiresAt, reservationId };
}

export const reserveCapacity = internalMutation({
  args: {
    clientSubmissionId: v.string(),
    publicSlug: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    reservationId: v.id("videoReservations"),
  }),
  handler: async (ctx, args) => {
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", args.publicSlug.trim().toLowerCase()),
      )
      .unique();
    if (!brand || brand.deletionStartedAt !== undefined) {
      unavailable(
        "COLLECTION_FORM_UNAVAILABLE",
        "Collection Form unavailable.",
      );
    }
    return await reserveForOrganization(
      ctx,
      brand._id,
      args.clientSubmissionId,
    );
  },
});

export const attachProviderUpload = internalMutation({
  args: {
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.string(),
    reservationId: v.id("videoReservations"),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
  },
  returns: v.id("videoAssets"),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.expiresAt <= Date.now() ||
      reservation.providerUploadId
    ) {
      unavailable(
        "VIDEO_RESERVATION_UNAVAILABLE",
        "Video reservation expired.",
      );
    }
    await requireOpenVideoOrganization(ctx, reservation.organizationId);
    const now = Date.now();
    await ctx.db.patch(reservation._id, {
      providerUploadId: args.providerUploadId,
      updatedAt: now,
    });
    return await ctx.db.insert("videoAssets", {
      captionsStatus: "requested",
      createdAt: now,
      fileSizeBytes: args.fileSizeBytes,
      mimeType: args.mimeType,
      organizationId: reservation.organizationId,
      provider: args.provider,
      providerUploadId: args.providerUploadId,
      reservationId: reservation._id,
      spokenLanguage: args.spokenLanguage,
      status: "awaiting_upload",
      updatedAt: now,
    });
  },
});

export const reserveRetryCapacity = internalMutation({
  args: {
    clientSubmissionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    failedVideoAssetId: v.id("videoAssets"),
    reservationId: v.id("videoReservations"),
    testimonialId: v.id("testimonials"),
  }),
  handler: async (ctx, args) => {
    const retry = await ctx.db
      .query("videoRetryLinks")
      .withIndex("by_token_hash", (index) =>
        index.eq("tokenHash", args.tokenHash),
      )
      .unique();
    if (!retry || retry.usedAt || retry.expiresAt <= Date.now()) {
      unavailable(
        "VIDEO_RETRY_UNAVAILABLE",
        "This replacement link is invalid, expired or already used.",
      );
    }
    const [failedAsset, testimonial, deletion] = await Promise.all([
      ctx.db.get(retry.videoAssetId),
      ctx.db.get(retry.testimonialId),
      ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", retry.testimonialId),
        )
        .unique(),
    ]);
    if (
      !failedAsset ||
      failedAsset.status !== "failed" ||
      !testimonial ||
      testimonial.moderationStatus === "spam" ||
      deletion ||
      failedAsset.testimonialId !== testimonial._id ||
      testimonial.organizationId !== retry.organizationId
    ) {
      unavailable(
        "VIDEO_RETRY_UNAVAILABLE",
        "This replacement link is no longer available.",
      );
    }
    await requireOpenVideoOrganization(ctx, retry.organizationId);
    const reserved = await reserveForOrganization(
      ctx,
      retry.organizationId,
      args.clientSubmissionId,
    );
    await ctx.db.patch(retry._id, {
      replacementReservationId: reserved.reservationId,
      usedAt: Date.now(),
    });
    return {
      ...reserved,
      failedVideoAssetId: failedAsset._id,
      testimonialId: testimonial._id,
    };
  },
});

export const attachRetryProviderUpload = internalMutation({
  args: {
    failedVideoAssetId: v.id("videoAssets"),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.string(),
    reservationId: v.id("videoReservations"),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    testimonialId: v.id("testimonials"),
    tokenHash: v.string(),
  },
  returns: v.id("videoAssets"),
  handler: async (ctx, args) => {
    const [retry, reservation, failedAsset, testimonial, deletion] =
      await Promise.all([
        ctx.db
          .query("videoRetryLinks")
          .withIndex("by_token_hash", (index) =>
            index.eq("tokenHash", args.tokenHash),
          )
          .unique(),
        ctx.db.get(args.reservationId),
        ctx.db.get(args.failedVideoAssetId),
        ctx.db.get(args.testimonialId),
        ctx.db
          .query("videoMediaDeletions")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", args.testimonialId),
          )
          .unique(),
      ]);
    if (
      !retry?.usedAt ||
      retry.replacementReservationId !== args.reservationId ||
      retry.videoAssetId !== args.failedVideoAssetId ||
      retry.testimonialId !== args.testimonialId ||
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.expiresAt <= Date.now() ||
      reservation.providerUploadId ||
      !failedAsset ||
      failedAsset.status !== "failed" ||
      failedAsset.testimonialId !== args.testimonialId ||
      !testimonial ||
      testimonial.moderationStatus === "spam" ||
      deletion ||
      testimonial.organizationId !== reservation.organizationId
    ) {
      unavailable(
        "VIDEO_RETRY_UNAVAILABLE",
        "This replacement upload is no longer available.",
      );
    }
    await requireOpenVideoOrganization(ctx, reservation.organizationId);
    const now = Date.now();
    await ctx.db.patch(reservation._id, {
      providerUploadId: args.providerUploadId,
      updatedAt: now,
    });
    await ctx.db.patch(failedAsset._id, {
      testimonialId: undefined,
      updatedAt: now,
    });
    return await ctx.db.insert("videoAssets", {
      captionsStatus: "requested",
      createdAt: now,
      fileSizeBytes: args.fileSizeBytes,
      mimeType: args.mimeType,
      organizationId: reservation.organizationId,
      provider: args.provider,
      providerUploadId: args.providerUploadId,
      reservationId: reservation._id,
      spokenLanguage: args.spokenLanguage,
      status: "awaiting_upload",
      testimonialId: testimonial._id,
      updatedAt: now,
    });
  },
});

export const releaseRetryCapacity = internalMutation({
  args: {
    reservationId: v.id("videoReservations"),
    tokenHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retry = await ctx.db
      .query("videoRetryLinks")
      .withIndex("by_token_hash", (index) =>
        index.eq("tokenHash", args.tokenHash),
      )
      .unique();
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_reservation", (index) =>
        index.eq("reservationId", args.reservationId),
      )
      .unique();
    if (retry?.replacementReservationId === args.reservationId && !asset) {
      await ctx.db.patch(retry._id, {
        replacementReservationId: undefined,
        usedAt: undefined,
      });
    }
    const reservation = await ctx.db.get(args.reservationId);
    if (reservation?.status === "reserved" && !asset) {
      await ctx.db.patch(reservation._id, {
        status: "released",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const releaseCapacity = internalMutation({
  args: { reservationId: v.id("videoReservations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (reservation?.status === "reserved") {
      await ctx.db.patch(reservation._id, {
        status: "released",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const expireReservationState = internalMutation({
  args: {
    reservationId: v.id("videoReservations"),
    retryTokenHash: v.optional(v.string()),
    retryTokenSeed: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (
      reservation?.status === "reserved" &&
      reservation.expiresAt <= Date.now()
    ) {
      await ctx.db.patch(reservation._id, {
        status: "released",
        updatedAt: Date.now(),
      });
      const asset = await ctx.db
        .query("videoAssets")
        .withIndex("by_reservation", (index) =>
          index.eq("reservationId", reservation._id),
        )
        .unique();
      if (asset && asset.status !== "ready" && asset.status !== "failed") {
        await ctx.db.patch(asset._id, {
          failureReason: "Upload timed out.",
          status: "failed",
          updatedAt: Date.now(),
        });
        if (args.retryTokenHash && args.retryTokenSeed) {
          await createVideoRetryLink(ctx, asset, {
            hash: args.retryTokenHash,
            seed: args.retryTokenSeed,
          });
        }
      }
    }
    return null;
  },
});

export const expireReservation = internalAction({
  args: { reservationId: v.id("videoReservations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const secret = process.env.VIDEO_WEBHOOK_INGEST_SECRET;
    const retryTokenSeed = `timeout:${String(args.reservationId)}`;
    const retryToken = secret
      ? await deriveVideoRetryToken(secret, retryTokenSeed)
      : undefined;
    await ctx.runMutation(internal.video.expireReservationState, {
      reservationId: args.reservationId,
      retryTokenHash: retryToken
        ? await hashSubmissionManagementToken(retryToken)
        : undefined,
      retryTokenSeed: retryToken ? retryTokenSeed : undefined,
    });
    return null;
  },
});

export const cancelUpload = mutation({
  args: {
    clientSubmissionId: v.string(),
    reservationId: v.id("videoReservations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    const asset = reservation
      ? await ctx.db
          .query("videoAssets")
          .withIndex("by_reservation", (index) =>
            index.eq("reservationId", reservation._id),
          )
          .unique()
      : null;
    if (
      reservation?.status === "reserved" &&
      reservation.clientSubmissionId ===
        normalizedClientSubmissionId(args.clientSubmissionId) &&
      !asset?.testimonialId
    ) {
      await ctx.db.patch(reservation._id, {
        status: "released",
        updatedAt: Date.now(),
      });
      if (asset && asset.status !== "ready") {
        await ctx.db.patch(asset._id, {
          failureReason: "Upload cancelled.",
          status: "failed",
          updatedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

export const cancelRetryUpload = mutation({
  args: {
    clientSubmissionId: v.string(),
    reservationId: v.id("videoReservations"),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const retry = await ctx.db
      .query("videoRetryLinks")
      .withIndex("by_token_hash", (index) => index.eq("tokenHash", tokenHash))
      .unique();
    const reservation = await ctx.db.get(args.reservationId);
    if (
      !retry?.usedAt ||
      retry.expiresAt <= Date.now() ||
      retry.replacementReservationId !== args.reservationId ||
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.clientSubmissionId !==
        normalizedClientSubmissionId(args.clientSubmissionId)
    ) {
      return null;
    }
    const [replacementAsset, failedAsset] = await Promise.all([
      ctx.db
        .query("videoAssets")
        .withIndex("by_reservation", (index) =>
          index.eq("reservationId", reservation._id),
        )
        .unique(),
      ctx.db.get(retry.videoAssetId),
    ]);
    if (
      !replacementAsset ||
      replacementAsset.status === "ready" ||
      replacementAsset.testimonialId !== retry.testimonialId ||
      !failedAsset ||
      failedAsset.status !== "failed" ||
      failedAsset.testimonialId
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.delete(replacementAsset._id);
    await ctx.db.patch(failedAsset._id, {
      testimonialId: retry.testimonialId,
      updatedAt: now,
    });
    await ctx.db.patch(reservation._id, {
      status: "released",
      updatedAt: now,
    });
    await ctx.db.patch(retry._id, {
      replacementReservationId: undefined,
      usedAt: undefined,
    });
    return null;
  },
});

export const createDirectUpload = action({
  args: {
    clientSubmissionId: v.string(),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    publicSlug: v.string(),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    turnstileToken: v.optional(v.string()),
  },
  returns: v.object({
    expiresAt: v.number(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    reservationId: v.id("videoReservations"),
    uploadUrl: v.string(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    await verifyTurnstileToken(args.turnstileToken, "collect_proof");
    await ctx.runMutation(
      internal.collectionRateLimit.recordPublicCollectionRequest,
      {
        publicSlug: args.publicSlug,
        submissionType: "video",
      },
    );
    const mimeType = validateUploadRequest(args.mimeType, args.fileSizeBytes);
    const reserved: {
      expiresAt: number;
      reservationId: import("./_generated/dataModel").Id<"videoReservations">;
    } = await ctx.runMutation(internal.video.reserveCapacity, {
      clientSubmissionId: args.clientSubmissionId,
      publicSlug: args.publicSlug,
    });
    let directUpload: DirectUpload | undefined;
    try {
      const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000");
      directUpload = await createVideoDirectUpload({
        corsOrigin: siteUrl.origin,
        passthrough: String(reserved.reservationId),
        spokenLanguage: args.spokenLanguage,
      });
      await ctx.runMutation(internal.video.attachProviderUpload, {
        fileSizeBytes: args.fileSizeBytes,
        mimeType,
        provider: directUpload.provider,
        providerUploadId: directUpload.uploadId,
        reservationId: reserved.reservationId,
        spokenLanguage: args.spokenLanguage,
      });
      return {
        expiresAt: reserved.expiresAt,
        provider: directUpload.provider,
        reservationId: reserved.reservationId,
        uploadUrl: directUpload.uploadUrl,
      };
    } catch (error) {
      try {
        if (directUpload) {
          await cancelVideoDirectUpload(
            directUpload.uploadId,
            directUpload.provider,
          );
        }
      } finally {
        await ctx.runMutation(internal.video.releaseCapacity, {
          reservationId: reserved.reservationId,
        });
      }
      throw error;
    }
  },
});

const videoSubmissionArgs = {
  ageConfirmed: v.boolean(),
  avatarReservationId: v.optional(v.id("submissionAvatarUploads")),
  avatarStorageId: v.optional(v.id("_storage")),
  clientSubmissionId: v.string(),
  company: v.optional(v.string()),
  consentAccepted: v.boolean(),
  consentText: v.string(),
  consentVersion: v.string(),
  durationSeconds: v.number(),
  rating: v.optional(v.number()),
  reservationId: v.id("videoReservations"),
  role: v.optional(v.string()),
  submitterEmail: v.string(),
  submitterName: v.string(),
};

type VideoDelivery = {
  attemptId: string;
  deliveryId: Id<"submissionEmailDeliveries">;
  recipientEmail: string;
  recipientKind: "submitter" | "owner";
};

type CreatedVideoRecords = {
  brandName: string;
  dashboardPath: string;
  deliveries: VideoDelivery[];
  moderationStatus: "pending";
  processingStatus: "awaiting_upload" | "processing" | "ready" | "failed";
  shouldCompleteFake: boolean;
  submitterName: string;
  testimonialId: Id<"testimonials">;
};

async function findCurrentOwnerEmail(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_organization_status", (index) =>
      index.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();
  for (const membership of memberships) {
    if (
      membership.email &&
      (await authzForOrganization(String(organizationId)).hasRole(
        ctx,
        membership.userId,
        "owner",
      ))
    ) {
      return membership.email;
    }
  }
  return undefined;
}

export const createVideoRecords = internalMutation({
  args: {
    ...videoSubmissionArgs,
    deliveryAttemptId: v.string(),
    managementTokenHash: v.string(),
  },
  returns: v.object({
    brandName: v.string(),
    dashboardPath: v.string(),
    deliveries: v.array(
      v.object({
        attemptId: v.string(),
        deliveryId: v.id("submissionEmailDeliveries"),
        recipientEmail: v.string(),
        recipientKind: v.union(v.literal("submitter"), v.literal("owner")),
      }),
    ),
    moderationStatus: v.literal("pending"),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    shouldCompleteFake: v.boolean(),
    submitterName: v.string(),
    testimonialId: v.id("testimonials"),
  }),
  handler: async (ctx, args): Promise<CreatedVideoRecords> => {
    const reservation = await ctx.db.get(args.reservationId);
    const clientSubmissionId = normalizedClientSubmissionId(
      args.clientSubmissionId,
    );
    if (!reservation || reservation.clientSubmissionId !== clientSubmissionId) {
      unavailable(
        "VIDEO_RESERVATION_UNAVAILABLE",
        "Video reservation expired. Upload the video again.",
      );
    }
    const brand = await ctx.db.get(reservation.organizationId);
    if (!brand || brand.deletionStartedAt !== undefined)
      unavailable(
        "COLLECTION_FORM_UNAVAILABLE",
        "Collection Form unavailable.",
      );
    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_organization_client_submission", (index) =>
        index
          .eq("organizationId", reservation.organizationId)
          .eq("clientSubmissionId", clientSubmissionId),
      )
      .unique();
    if (existing) {
      if (existing.submissionType !== "video") {
        unavailable(
          "VIDEO_SUBMISSION_CONFLICT",
          "This browser submission was already used.",
        );
      }
      const existingAsset = await ctx.db
        .query("videoAssets")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", existing._id),
        )
        .unique();
      if (!existingAsset) {
        unavailable("VIDEO_ASSET_UNAVAILABLE", "Video upload unavailable.");
      }
      const deliveries = await ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", brand._id),
        )
        .filter((queryFilter) =>
          queryFilter.eq(queryFilter.field("testimonialId"), existing._id),
        )
        .collect();
      const retryable = deliveries.filter(
        (delivery) => delivery.status === "failed",
      );
      const currentOwnerEmail =
        brand.newSubmissionEmailNotificationsEnabled === false
          ? undefined
          : await findCurrentOwnerEmail(ctx, brand._id);
      if (
        retryable.some((delivery) => delivery.recipientKind === "submitter")
      ) {
        await ctx.db.patch(existing._id, {
          managementTokenHash: args.managementTokenHash,
          updatedAt: Date.now(),
        });
      }
      for (const delivery of retryable) {
        await ctx.db.patch(delivery._id, {
          attemptId: args.deliveryAttemptId,
          attemptLeaseExpiresAt: Date.now() + emailAttemptLeaseMs,
          error: undefined,
          provider: undefined,
          providerMessageId: undefined,
          recipientEmail:
            delivery.recipientKind === "owner" && currentOwnerEmail
              ? currentOwnerEmail
              : delivery.recipientEmail,
          status: "pending",
          updatedAt: Date.now(),
        });
      }
      return {
        brandName: brand.name,
        dashboardPath: `/org/${brand.slug}/dashboard`,
        deliveries: retryable.map((delivery) => ({
          attemptId: args.deliveryAttemptId,
          deliveryId: delivery._id,
          recipientEmail:
            delivery.recipientKind === "owner" && currentOwnerEmail
              ? currentOwnerEmail
              : delivery.recipientEmail,
          recipientKind: delivery.recipientKind,
        })),
        moderationStatus: "pending" as const,
        processingStatus: existingAsset.status,
        shouldCompleteFake: false,
        submitterName: existing.submitterName,
        testimonialId: existing._id,
      };
    }
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_reservation", (index) =>
        index.eq("reservationId", reservation._id),
      )
      .unique();
    if (!asset || asset.testimonialId) {
      unavailable("VIDEO_ASSET_UNAVAILABLE", "Video upload unavailable.");
    }
    const reservationCanAcceptSubmission =
      (reservation.status === "reserved" &&
        reservation.expiresAt > Date.now()) ||
      (reservation.status === "consumed" && asset.status === "ready");
    if (!reservationCanAcceptSubmission) {
      unavailable(
        "VIDEO_RESERVATION_UNAVAILABLE",
        "Video reservation expired. Upload the video again.",
      );
    }
    let metadata;
    try {
      metadata = assertVideoMetadata({
        durationSeconds: args.durationSeconds,
        mimeType: asset.mimeType,
      });
    } catch (error) {
      unavailable(
        "INVALID_VIDEO_SUBMISSION",
        error instanceof Error ? error.message : "Invalid video.",
      );
    }
    const submitterName = args.submitterName.trim();
    const submitterEmail = args.submitterEmail.trim().toLowerCase();
    if (
      !args.ageConfirmed ||
      !args.consentAccepted ||
      !submitterName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail) ||
      (args.rating !== undefined &&
        (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5))
    ) {
      unavailable("INVALID_VIDEO_SUBMISSION", "Check the required fields.");
    }
    if (args.avatarStorageId) {
      const avatarReservation = args.avatarReservationId
        ? await ctx.db.get(args.avatarReservationId)
        : null;
      if (
        !avatarReservation ||
        avatarReservation.organizationId !== brand._id ||
        avatarReservation.clientSubmissionId !== clientSubmissionId ||
        avatarReservation.storageId !== args.avatarStorageId ||
        avatarReservation.expiresAt <= Date.now()
      ) {
        unavailable("AVATAR_UPLOAD_UNAVAILABLE", "Upload the photo again.");
      }
      await validateExclusiveStoredImage(ctx, args.avatarStorageId, {
        kind: "testimonial",
      });
    }
    const consent = buildPublicationConsent({
      brandName: brand.name,
      privacyContact: brand.privacyContact,
      suppliedIdentity: {
        avatarSupplied: args.avatarStorageId !== undefined,
        company: args.company?.trim() || undefined,
        name: submitterName,
        rating: args.rating,
        role: args.role?.trim() || undefined,
      },
    });
    try {
      assertPublicationConsentSnapshot(consent, {
        text: args.consentText,
        version: args.consentVersion,
      });
    } catch (error) {
      unavailable(
        "CONSENT_CHANGED",
        error instanceof Error ? error.message : "Publication Consent changed.",
      );
    }
    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      avatarStorageId: args.avatarStorageId,
      clientSubmissionId,
      company: args.company?.trim() || undefined,
      contentVersion: 1,
      createdAt: now,
      managementTokenHash: args.managementTokenHash,
      moderationStatus: "pending",
      organizationId: brand._id,
      rating: args.rating,
      role: args.role?.trim() || undefined,
      submissionType: "video",
      submitterEmail,
      submitterName,
      text: "",
      updatedAt: now,
    });
    await ctx.db.insert("publicationConsents", {
      acceptedAt: now,
      brandName: brand.name,
      consentText: consent.text,
      consentVersion: consent.version,
      identityFields: consent.identityFields,
      organizationId: brand._id,
      testimonialId,
    });
    await ctx.db.patch(asset._id, {
      durationSeconds:
        asset.status === "ready" && asset.durationSeconds !== undefined
          ? asset.durationSeconds
          : metadata.durationSeconds,
      testimonialId,
      updatedAt: now,
    });
    if (asset.status === "ready") {
      await consumeReadyVideoCredit(ctx, {
        organizationId: brand._id,
        plan: reservation.plan,
        testimonialId,
      });
    }
    if (args.avatarReservationId) await ctx.db.delete(args.avatarReservationId);

    const deliveries: VideoDelivery[] = [];
    const submitterDeliveryId = await ctx.db.insert(
      "submissionEmailDeliveries",
      {
        attemptId: args.deliveryAttemptId,
        attemptLeaseExpiresAt: now + emailAttemptLeaseMs,
        createdAt: now,
        organizationId: brand._id,
        recipientEmail: submitterEmail,
        recipientKind: "submitter",
        status: "pending",
        testimonialId,
        updatedAt: now,
      },
    );
    deliveries.push({
      attemptId: args.deliveryAttemptId,
      deliveryId: submitterDeliveryId,
      recipientEmail: submitterEmail,
      recipientKind: "submitter",
    });
    if (brand.newSubmissionEmailNotificationsEnabled !== false) {
      const ownerEmail = await findCurrentOwnerEmail(ctx, brand._id);
      if (ownerEmail) {
        const deliveryId = await ctx.db.insert("submissionEmailDeliveries", {
          attemptId: args.deliveryAttemptId,
          attemptLeaseExpiresAt: now + emailAttemptLeaseMs,
          createdAt: now,
          organizationId: brand._id,
          recipientEmail: ownerEmail,
          recipientKind: "owner",
          status: "pending",
          testimonialId,
          updatedAt: now,
        });
        deliveries.push({
          attemptId: args.deliveryAttemptId,
          deliveryId,
          recipientEmail: ownerEmail,
          recipientKind: "owner",
        });
      }
    }
    return {
      brandName: brand.name,
      dashboardPath: `/org/${brand.slug}/dashboard`,
      deliveries,
      moderationStatus: "pending" as const,
      processingStatus: asset.status,
      shouldCompleteFake: true,
      submitterName,
      testimonialId,
    };
  },
});

async function deliverVideoSubmissionEmails(
  ctx: ActionCtx,
  created: {
    brandName: string;
    dashboardPath: string;
    deliveries: VideoDelivery[];
    submitterName: string;
  },
  managementToken: string,
) {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  await Promise.all(
    created.deliveries.map(async (delivery) => {
      const message =
        delivery.recipientKind === "submitter"
          ? buildVideoSubmissionConfirmationEmail({
              brandName: created.brandName,
              email: delivery.recipientEmail,
              url: `${siteUrl}/s/${encodeURIComponent(managementToken)}`,
            })
          : buildNewPendingTestimonialEmail({
              brandName: created.brandName,
              email: delivery.recipientEmail,
              submissionType: "video",
              submitterName: created.submitterName,
              url: `${siteUrl}${created.dashboardPath}`,
            });
      try {
        const receipt = await sendTransactionalEmail({
          ...message,
          idempotencyKey: buildSubmissionEmailIdempotencyKey(
            delivery.attemptId,
            String(delivery.deliveryId),
          ),
        });
        await ctx.runMutation(internal.submissions.recordEmailDelivery, {
          attemptId: delivery.attemptId,
          deliveryId: delivery.deliveryId,
          provider: receipt.provider,
          providerMessageId: receipt.providerMessageId,
          status: "sent",
        });
      } catch (error) {
        await ctx.runMutation(internal.submissions.recordEmailDelivery, {
          attemptId: delivery.attemptId,
          deliveryId: delivery.deliveryId,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Delivery failed.",
          status:
            error instanceof UncertainEmailDeliveryError
              ? "uncertain"
              : "failed",
        });
      }
    }),
  );
}

export const completeFakeAsset = internalMutation({
  args: { testimonialId: v.id("testimonials") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (process.env.MUX_PROVIDER !== "fake") {
      unavailable(
        "FAKE_VIDEO_PROVIDER_DISABLED",
        "Fake video processing is disabled.",
      );
    }
    const asset = await ctx.db
      .query("videoAssets")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", args.testimonialId),
      )
      .unique();
    if (!asset || asset.provider !== "fake" || asset.status === "failed") {
      unavailable("VIDEO_ASSET_UNAVAILABLE", "Video upload unavailable.");
    }
    const reservation = await ctx.db.get(asset.reservationId);
    if (!reservation || reservation.status !== "reserved") {
      unavailable(
        "VIDEO_RESERVATION_UNAVAILABLE",
        "Video reservation expired.",
      );
    }
    await requireOpenVideoOrganization(ctx, reservation.organizationId);
    const now = Date.now();
    await ctx.db.patch(asset._id, {
      captionsStatus: "ready",
      playbackId: `fake-playback-${String(asset._id)}`,
      providerAssetId: `fake-asset-${String(asset._id)}`,
      status: "ready",
      updatedAt: now,
    });
    await ctx.db.patch(reservation._id, {
      status: "consumed",
      updatedAt: now,
    });
    await consumeReadyVideoCredit(ctx, {
      organizationId: reservation.organizationId,
      plan: reservation.plan,
      testimonialId: args.testimonialId,
    });
    return null;
  },
});

export const submit = action({
  args: videoSubmissionArgs,
  returns: v.object({
    moderationStatus: v.literal("pending"),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    testimonialId: v.id("testimonials"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    moderationStatus: "pending";
    processingStatus: "awaiting_upload" | "processing" | "ready" | "failed";
    testimonialId: Id<"testimonials">;
  }> => {
    const managementToken = randomSubmissionManagementToken();
    const created: CreatedVideoRecords = await ctx.runMutation(
      internal.video.createVideoRecords,
      {
        ...args,
        deliveryAttemptId: randomSubmissionManagementToken(),
        managementTokenHash:
          await hashSubmissionManagementToken(managementToken),
      },
    );
    const processingStatus =
      process.env.MUX_PROVIDER === "fake" && created.shouldCompleteFake
        ? await ctx
            .runMutation(internal.video.completeFakeAsset, {
              testimonialId: created.testimonialId,
            })
            .then(() => "ready" as const)
        : created.processingStatus;
    await deliverVideoSubmissionEmails(ctx, created, managementToken);
    return {
      moderationStatus: created.moderationStatus,
      processingStatus,
      testimonialId: created.testimonialId,
    };
  },
});

export const getRetryContext = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      brandName: v.string(),
      publicSlug: v.string(),
      spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    }),
  ),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const retry = await ctx.db
      .query("videoRetryLinks")
      .withIndex("by_token_hash", (index) => index.eq("tokenHash", tokenHash))
      .unique();
    if (!retry || retry.usedAt || retry.expiresAt <= Date.now()) return null;
    const [brand, asset, testimonial] = await Promise.all([
      ctx.db.get(retry.organizationId),
      ctx.db.get(retry.videoAssetId),
      ctx.db.get(retry.testimonialId),
    ]);
    if (
      !brand ||
      !asset ||
      asset.status !== "failed" ||
      !testimonial ||
      testimonial.moderationStatus === "spam"
    )
      return null;
    return {
      brandName: brand.name,
      publicSlug: brand.publicSlug,
      spokenLanguage: asset.spokenLanguage,
    };
  },
});

export const createRetryDirectUpload = action({
  args: {
    clientSubmissionId: v.string(),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    token: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    reservationId: v.id("videoReservations"),
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const mimeType = validateUploadRequest(args.mimeType, args.fileSizeBytes);
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const reserved: {
      expiresAt: number;
      failedVideoAssetId: Id<"videoAssets">;
      reservationId: Id<"videoReservations">;
      testimonialId: Id<"testimonials">;
    } = await ctx.runMutation(internal.video.reserveRetryCapacity, {
      clientSubmissionId: args.clientSubmissionId,
      tokenHash,
    });
    let directUpload: DirectUpload | undefined;
    try {
      const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000");
      directUpload = await createVideoDirectUpload({
        corsOrigin: siteUrl.origin,
        passthrough: String(reserved.reservationId),
        spokenLanguage: args.spokenLanguage,
      });
      await ctx.runMutation(internal.video.attachRetryProviderUpload, {
        failedVideoAssetId: reserved.failedVideoAssetId,
        fileSizeBytes: args.fileSizeBytes,
        mimeType,
        provider: directUpload.provider,
        providerUploadId: directUpload.uploadId,
        reservationId: reserved.reservationId,
        spokenLanguage: args.spokenLanguage,
        testimonialId: reserved.testimonialId,
        tokenHash,
      });
      if (directUpload.provider === "fake") {
        await ctx.runMutation(internal.video.completeFakeAsset, {
          testimonialId: reserved.testimonialId,
        });
      }
      return {
        expiresAt: reserved.expiresAt,
        provider: directUpload.provider,
        reservationId: reserved.reservationId,
        uploadUrl: directUpload.uploadUrl,
      };
    } catch (error) {
      try {
        if (directUpload) {
          await cancelVideoDirectUpload(
            directUpload.uploadId,
            directUpload.provider,
          );
        }
      } finally {
        await ctx.runMutation(internal.video.releaseRetryCapacity, {
          reservationId: reserved.reservationId,
          tokenHash,
        });
      }
      throw error;
    }
  },
});

export const revokeRetryLinks = mutation({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({ revoked: v.number() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const testimonial = await ctx.db.get(args.testimonialId);
    if (
      !testimonial ||
      testimonial.organizationId !== access.organization._id
    ) {
      unavailable("TESTIMONIAL_UNAVAILABLE", "Testimonial unavailable.");
    }
    const links = await ctx.db
      .query("videoRetryLinks")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .collect();
    const now = Date.now();
    const active = links.filter((link) => !link.usedAt && link.expiresAt > now);
    await Promise.all(
      active.map((link) => ctx.db.patch(link._id, { expiresAt: now })),
    );
    return { revoked: active.length };
  },
});
