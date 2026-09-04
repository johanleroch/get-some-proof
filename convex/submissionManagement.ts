import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import {
  assertPublicationConsentSnapshot,
  buildPublicationConsent,
  deriveSubmissionManagementToken,
  hashSubmissionManagementToken,
  randomSubmissionManagementToken,
} from "./domain/submission";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import { sendTransactionalEmail } from "./email/provider";
import { buildReplacementManagementLinkEmail } from "./email/templates";
import {
  cancelVideoDirectUpload,
  createVideoDirectUpload,
  type DirectUpload,
} from "./videoProvider";

const replacementReservationTtlMs = 2 * 60 * 60 * 1_000;
const maximumVideoFileBytes = 512 * 1024 * 1024;
const supportedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function unavailable(
  message = "This management link is no longer active.",
): never {
  throw new ConvexError({ code: "MANAGEMENT_LINK_UNAVAILABLE", message });
}

function staleRevision(): never {
  throw new ConvexError({
    code: "REVISION_STALE",
    message: "This testimonial changed. Reload it before confirming again.",
  });
}

function paymentGraceVideoBlocked(): never {
  throw new ConvexError({
    code: "PAYMENT_GRACE_VIDEO_BLOCKED",
    message: "New video storage is paused until the payment method is updated.",
  });
}

function currentContentVersion(testimonial: Doc<"testimonials">) {
  return testimonial.contentVersion ?? 1;
}

async function findManagedTestimonial(ctx: MutationCtx, tokenHash: string) {
  const testimonial = await ctx.db
    .query("testimonials")
    .withIndex("by_management_token_hash", (index) =>
      index.eq("managementTokenHash", tokenHash),
    )
    .unique();
  if (
    !testimonial ||
    testimonial.moderationStatus === "spam" ||
    (testimonial.managementTokenExpiresAt !== undefined &&
      testimonial.managementTokenExpiresAt <= Date.now())
  ) {
    unavailable();
  }
  const organization = await ctx.db.get(testimonial.organizationId);
  if (!organization || organization.deletionStartedAt !== undefined) {
    unavailable();
  }
  return testimonial;
}

function normalizeIdentity(args: {
  company?: string;
  rating?: number;
  role?: string;
  submitterName: string;
}) {
  const submitterName = args.submitterName.trim();
  const company = args.company?.trim() || undefined;
  const role = args.role?.trim() || undefined;
  if (!submitterName || Array.from(submitterName).length > 100) {
    unavailable("Name is required and must be 100 characters or fewer.");
  }
  if (company && Array.from(company).length > 100) {
    unavailable("Company must be 100 characters or fewer.");
  }
  if (role && Array.from(role).length > 100) {
    unavailable("Role must be 100 characters or fewer.");
  }
  if (
    args.rating !== undefined &&
    (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5)
  ) {
    unavailable("Rating must be a whole number between 1 and 5.");
  }
  return { company, rating: args.rating, role, submitterName };
}

async function enqueueAssetCleanup(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    provider: "fake" | "mux";
    providerAssetId?: string;
    providerUploadId?: string;
    testimonialId: Id<"testimonials">;
  },
) {
  if (!input.providerAssetId && !input.providerUploadId) return;
  const cleanupJobId = await ctx.db.insert("videoProviderCleanupJobs", {
    attempts: 0,
    createdAt: Date.now(),
    organizationId: input.organizationId,
    provider: input.provider,
    providerAssetId: input.providerAssetId,
    providerUploadId: input.providerUploadId,
    testimonialId: input.testimonialId,
  });
  await ctx.scheduler.runAfter(0, internal.videoMedia.processProviderCleanup, {
    cleanupJobId,
  });
}

async function enqueueVideoAssetCleanup(
  ctx: MutationCtx,
  asset: Doc<"videoAssets">,
  testimonialId: Id<"testimonials">,
) {
  await enqueueAssetCleanup(ctx, {
    organizationId: asset.organizationId,
    provider: asset.provider,
    providerAssetId: asset.providerAssetId,
    providerUploadId: asset.providerAssetId
      ? undefined
      : asset.providerUploadId,
    testimonialId,
  });
  if (asset.downloadProviderAssetId) {
    await enqueueAssetCleanup(ctx, {
      organizationId: asset.organizationId,
      provider: asset.provider,
      providerAssetId: asset.downloadProviderAssetId,
      testimonialId,
    });
  }
}

export const get = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      avatarUrl: v.union(v.null(), v.string()),
      brandName: v.string(),
      company: v.optional(v.string()),
      consentAcceptedAt: v.number(),
      contentVersion: v.number(),
      currentVideo: v.optional(
        v.object({
          playbackId: v.string(),
          posterTimeSeconds: v.optional(v.number()),
        }),
      ),
      moderationStatus: v.union(
        v.literal("pending"),
        v.literal("published"),
        v.literal("archived"),
        v.literal("spam"),
      ),
      privacyContact: v.string(),
      publicSlug: v.string(),
      rating: v.optional(v.number()),
      replacement: v.optional(
        v.object({
          revisionId: v.id("submissionVideoRevisions"),
          status: v.union(
            v.literal("awaiting_upload"),
            v.literal("processing"),
            v.literal("ready"),
            v.literal("failed"),
          ),
        }),
      ),
      role: v.optional(v.string()),
      submissionType: v.union(v.literal("text"), v.literal("video")),
      submitterEmail: v.string(),
      submitterName: v.string(),
      text: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.token)) return null;
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const testimonial = await ctx.db
      .query("testimonials")
      .withIndex("by_management_token_hash", (index) =>
        index.eq("managementTokenHash", tokenHash),
      )
      .unique();
    if (
      !testimonial ||
      (testimonial.managementTokenExpiresAt !== undefined &&
        testimonial.managementTokenExpiresAt <= Date.now())
    ) {
      return null;
    }
    const [brand, consent, revision, avatarUrl, currentVideoAsset] =
      await Promise.all([
        ctx.db.get(testimonial.organizationId),
        ctx.db
          .query("publicationConsents")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique(),
        testimonial.submissionType === "video"
          ? ctx.db
              .query("submissionVideoRevisions")
              .withIndex("by_testimonial_status", (index) =>
                index
                  .eq("testimonialId", testimonial._id)
                  .eq("status", "active"),
              )
              .unique()
          : null,
        testimonial.avatarStorageId
          ? ctx.storage.getUrl(testimonial.avatarStorageId)
          : null,
        testimonial.submissionType === "video"
          ? ctx.db
              .query("videoAssets")
              .withIndex("by_testimonial", (index) =>
                index.eq("testimonialId", testimonial._id),
              )
              .unique()
          : null,
      ]);
    if (!brand || !consent) return null;
    const replacementAsset = revision?.videoAssetId
      ? await ctx.db.get(revision.videoAssetId)
      : null;
    return {
      avatarUrl,
      brandName: brand.name,
      company: testimonial.company,
      consentAcceptedAt: consent.acceptedAt,
      contentVersion: currentContentVersion(testimonial),
      currentVideo:
        currentVideoAsset?.status === "ready" && currentVideoAsset.playbackId
          ? {
              playbackId: currentVideoAsset.playbackId,
              posterTimeSeconds: currentVideoAsset.durationSeconds
                ? currentVideoAsset.durationSeconds / 2
                : undefined,
            }
          : undefined,
      moderationStatus: testimonial.moderationStatus,
      privacyContact: brand.privacyContact,
      publicSlug: brand.publicSlug,
      rating: testimonial.rating,
      replacement:
        revision && replacementAsset
          ? { revisionId: revision._id, status: replacementAsset.status }
          : undefined,
      role: testimonial.role,
      submissionType: testimonial.submissionType,
      submitterEmail: testimonial.submitterEmail,
      submitterName: testimonial.submitterName,
      text: testimonial.text,
    };
  },
});

const revisionArgs = {
  avatarReservationId: v.optional(v.id("submissionAvatarUploads")),
  avatarStorageId: v.optional(v.id("_storage")),
  company: v.optional(v.string()),
  consentAccepted: v.boolean(),
  consentText: v.string(),
  consentVersion: v.string(),
  expectedContentVersion: v.number(),
  rating: v.optional(v.number()),
  removeAvatar: v.optional(v.boolean()),
  revisionId: v.optional(v.id("submissionVideoRevisions")),
  role: v.optional(v.string()),
  submitterName: v.string(),
  text: v.string(),
  token: v.string(),
};

export const confirmRevision = mutation({
  args: revisionArgs,
  returns: v.object({
    contentVersion: v.number(),
    moderationStatus: v.literal("pending"),
  }),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const testimonial = await findManagedTestimonial(ctx, tokenHash);
    const version = currentContentVersion(testimonial);
    if (version !== args.expectedContentVersion) staleRevision();
    if (!args.consentAccepted) {
      unavailable("Fresh Publication Consent is required.");
    }
    const [brand, consent, projection, deletion] = await Promise.all([
      ctx.db.get(testimonial.organizationId),
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
    if (!brand || !consent || deletion) unavailable();
    const identity = normalizeIdentity(args);
    const text = args.text.trim();
    if (
      testimonial.submissionType === "text" &&
      (Array.from(text).length < 20 || Array.from(text).length > 2_000)
    ) {
      unavailable("Testimonial text must be between 20 and 2,000 characters.");
    }
    if (testimonial.submissionType === "text" && args.revisionId) {
      unavailable("This text testimonial cannot accept a video replacement.");
    }
    if (testimonial.submissionType === "video" && !args.revisionId) {
      const activeReplacement = await ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_testimonial_status", (index) =>
          index.eq("testimonialId", testimonial._id).eq("status", "active"),
        )
        .unique();
      if (activeReplacement) {
        unavailable("Finish or retry the replacement video before confirming.");
      }
    }

    let nextAvatarStorageId = testimonial.avatarStorageId;
    if (args.removeAvatar) nextAvatarStorageId = undefined;
    if (args.avatarStorageId) {
      const reservation = args.avatarReservationId
        ? await ctx.db.get(args.avatarReservationId)
        : null;
      if (
        !reservation ||
        reservation.organizationId !== testimonial.organizationId ||
        reservation.storageId !== args.avatarStorageId ||
        reservation.expiresAt <= Date.now()
      ) {
        unavailable("Avatar upload unavailable. Upload it again.");
      }
      await validateExclusiveStoredImage(ctx, args.avatarStorageId, {
        kind: "testimonial",
      });
      nextAvatarStorageId = args.avatarStorageId;
    }
    const nextConsent = buildPublicationConsent({
      brandName: brand.name,
      privacyContact: brand.privacyContact,
      suppliedIdentity: {
        avatarSupplied: nextAvatarStorageId !== undefined,
        company: identity.company,
        name: identity.submitterName,
        rating: identity.rating,
        role: identity.role,
      },
    });
    try {
      assertPublicationConsentSnapshot(nextConsent, {
        text: args.consentText,
        version: args.consentVersion,
      });
    } catch (error) {
      unavailable(
        error instanceof Error ? error.message : "Publication Consent changed.",
      );
    }

    if (testimonial.submissionType === "video" && args.revisionId) {
      const revision = await ctx.db.get(args.revisionId!);
      if (
        !revision ||
        revision.status !== "active" ||
        revision.testimonialId !== testimonial._id ||
        revision.baseContentVersion !== version ||
        !revision.videoAssetId
      ) {
        staleRevision();
      }
      const [replacementAsset, currentAsset] = await Promise.all([
        ctx.db.get(revision.videoAssetId),
        ctx.db
          .query("videoAssets")
          .withIndex("by_testimonial", (index) =>
            index.eq("testimonialId", testimonial._id),
          )
          .unique(),
      ]);
      if (!replacementAsset || replacementAsset.status !== "ready") {
        unavailable("Wait for the replacement video to be Ready.");
      }
      if (!currentAsset) unavailable("Current video unavailable.");
      await enqueueVideoAssetCleanup(ctx, currentAsset, testimonial._id);
      await ctx.db.patch(currentAsset._id, {
        testimonialId: undefined,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(replacementAsset._id, {
        testimonialId: testimonial._id,
        updatedAt: Date.now(),
      });
      await ctx.db.patch(revision._id, {
        status: "confirmed",
        updatedAt: Date.now(),
      });
      await ctx.db.delete(currentAsset._id);
      const oldReservation = await ctx.db.get(currentAsset.reservationId);
      if (oldReservation) await ctx.db.delete(oldReservation._id);
    }

    if (projection) await ctx.db.delete(projection._id);
    const now = Date.now();
    await ctx.db.patch(consent._id, {
      acceptedAt: now,
      brandName: brand.name,
      consentText: nextConsent.text,
      consentVersion: nextConsent.version,
      identityFields: nextConsent.identityFields,
    });
    await ctx.db.patch(testimonial._id, {
      avatarStorageId: nextAvatarStorageId,
      company: identity.company,
      contentVersion: version + 1,
      moderationStatus: "pending",
      rating: identity.rating,
      role: identity.role,
      submitterName: identity.submitterName,
      text: testimonial.submissionType === "text" ? text : "",
      updatedAt: now,
    });
    if (args.avatarReservationId) await ctx.db.delete(args.avatarReservationId);
    if (
      testimonial.avatarStorageId &&
      testimonial.avatarStorageId !== nextAvatarStorageId
    ) {
      await ctx.storage.delete(testimonial.avatarStorageId);
    }
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: "Submitter",
      actorUserId: "submitter",
      eventType: "testimonial.revised",
      newValue: "pending",
      organizationId: testimonial.organizationId,
      previousValue: testimonial.moderationStatus,
      targetId: String(testimonial._id),
      targetLabel: "Revised Testimonial",
      targetType: "testimonial",
    });
    return {
      contentVersion: version + 1,
      moderationStatus: "pending" as const,
    };
  },
});

export const reserveVideoReplacement = internalMutation({
  args: {
    clientRevisionId: v.string(),
    expectedContentVersion: v.number(),
    tokenHash: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    organizationId: v.id("organizations"),
    reservationId: v.id("videoReservations"),
    revisionId: v.id("submissionVideoRevisions"),
    testimonialId: v.id("testimonials"),
  }),
  handler: async (ctx, args) => {
    const testimonial = await findManagedTestimonial(ctx, args.tokenHash);
    if (testimonial.submissionType !== "video") {
      unavailable("Only video testimonials can replace video media.");
    }
    const version = currentContentVersion(testimonial);
    if (version !== args.expectedContentVersion) staleRevision();
    const [existing, deletion] = await Promise.all([
      ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_testimonial_status", (index) =>
          index.eq("testimonialId", testimonial._id).eq("status", "active"),
        )
        .unique(),
      ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
    if (deletion) unavailable("This testimonial is being permanently deleted.");
    if (existing) {
      const asset = existing.videoAssetId
        ? await ctx.db.get(existing.videoAssetId)
        : null;
      if (!asset || asset.status !== "failed") {
        unavailable("A replacement video is already in progress.");
      }
      await enqueueVideoAssetCleanup(ctx, asset, testimonial._id);
      await ctx.db.delete(asset._id);
      const reservation = await ctx.db.get(existing.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
      await ctx.db.patch(existing._id, {
        status: "superseded",
        updatedAt: Date.now(),
      });
    }
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      testimonial.organizationId,
    );
    if (entitlement.state === "past_due") paymentGraceVideoBlocked();
    const now = Date.now();
    const expiresAt = now + replacementReservationTtlMs;
    const reservationId = await ctx.db.insert("videoReservations", {
      clientSubmissionId: args.clientRevisionId,
      createdAt: now,
      expiresAt,
      organizationId: testimonial.organizationId,
      plan: entitlement.effectivePlan,
      status: "reserved",
      updatedAt: now,
    });
    const revisionId = await ctx.db.insert("submissionVideoRevisions", {
      baseContentVersion: version,
      createdAt: now,
      organizationId: testimonial.organizationId,
      reservationId,
      status: "active",
      testimonialId: testimonial._id,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      replacementReservationTtlMs,
      internal.video.expireReservation,
      { reservationId },
    );
    return {
      expiresAt,
      organizationId: testimonial.organizationId,
      reservationId,
      revisionId,
      testimonialId: testimonial._id,
    };
  },
});

export const attachVideoReplacement = internalMutation({
  args: {
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.string(),
    reservationId: v.id("videoReservations"),
    revisionId: v.id("submissionVideoRevisions"),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    tokenHash: v.string(),
  },
  returns: v.id("videoAssets"),
  handler: async (ctx, args) => {
    const testimonial = await findManagedTestimonial(ctx, args.tokenHash);
    const [revision, reservation, deletion] = await Promise.all([
      ctx.db.get(args.revisionId),
      ctx.db.get(args.reservationId),
      ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
    if (
      deletion ||
      !revision ||
      revision.status !== "active" ||
      revision.testimonialId !== testimonial._id ||
      revision.reservationId !== args.reservationId ||
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.expiresAt <= Date.now() ||
      reservation.providerUploadId
    ) {
      unavailable("This replacement upload is no longer active.");
    }
    const now = Date.now();
    await ctx.db.patch(reservation._id, {
      providerUploadId: args.providerUploadId,
      updatedAt: now,
    });
    const videoAssetId = await ctx.db.insert("videoAssets", {
      captionsStatus: "requested",
      createdAt: now,
      fileSizeBytes: args.fileSizeBytes,
      mimeType: args.mimeType,
      organizationId: testimonial.organizationId,
      provider: args.provider,
      providerUploadId: args.providerUploadId,
      reservationId: reservation._id,
      spokenLanguage: args.spokenLanguage,
      status: "awaiting_upload",
      updatedAt: now,
    });
    await ctx.db.patch(revision._id, { videoAssetId, updatedAt: now });
    return videoAssetId;
  },
});

export const completeFakeVideoReplacement = internalMutation({
  args: { videoAssetId: v.id("videoAssets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (process.env.MUX_PROVIDER !== "fake") return null;
    const asset = await ctx.db.get(args.videoAssetId);
    if (!asset || asset.provider !== "fake") return null;
    const reservation = await ctx.db.get(asset.reservationId);
    if (!reservation || reservation.status !== "reserved") return null;
    const now = Date.now();
    await ctx.db.patch(asset._id, {
      captionsStatus: "ready",
      durationSeconds: 1,
      playbackId: `fake-playback-${String(asset._id)}`,
      providerAssetId: `fake-asset-${String(asset._id)}`,
      status: "ready",
      updatedAt: now,
    });
    await ctx.db.patch(reservation._id, { status: "consumed", updatedAt: now });
    return null;
  },
});

export const releaseVideoReplacement = internalMutation({
  args: {
    reservationId: v.id("videoReservations"),
    revisionId: v.id("submissionVideoRevisions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionId);
    if (revision?.status === "active" && !revision.videoAssetId) {
      await ctx.db.patch(revision._id, {
        status: "superseded",
        updatedAt: Date.now(),
      });
    }
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

export const cancelVideoReplacement = mutation({
  args: {
    reservationId: v.id("videoReservations"),
    revisionId: v.id("submissionVideoRevisions"),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const testimonial = await findManagedTestimonial(ctx, tokenHash);
    const [revision, reservation] = await Promise.all([
      ctx.db.get(args.revisionId),
      ctx.db.get(args.reservationId),
    ]);
    if (
      !revision ||
      revision.status !== "active" ||
      revision.testimonialId !== testimonial._id ||
      revision.reservationId !== args.reservationId ||
      !reservation ||
      reservation.status !== "reserved" ||
      reservation.organizationId !== testimonial.organizationId
    ) {
      return null;
    }
    const asset = revision.videoAssetId
      ? await ctx.db.get(revision.videoAssetId)
      : null;
    if (asset?.status === "ready") return null;
    const now = Date.now();
    if (asset) {
      await enqueueVideoAssetCleanup(ctx, asset, testimonial._id);
      await ctx.db.delete(asset._id);
    }
    await ctx.db.patch(revision._id, {
      status: "superseded",
      updatedAt: now,
    });
    await ctx.db.patch(reservation._id, {
      status: "released",
      updatedAt: now,
    });
    return null;
  },
});

export const recordDetachedReplacementUpload = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.string(),
    reservationId: v.id("videoReservations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (reservation && reservation.organizationId !== args.organizationId) {
      unavailable("This replacement upload does not match its reservation.");
    }
    await enqueueAssetCleanup(ctx, {
      organizationId: args.organizationId,
      provider: args.provider,
      providerUploadId: args.providerUploadId,
      testimonialId: args.testimonialId,
    });
    return null;
  },
});

export const createVideoReplacementUpload = action({
  args: {
    expectedContentVersion: v.number(),
    fileSizeBytes: v.number(),
    mimeType: v.string(),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    token: v.string(),
  },
  returns: v.object({
    expiresAt: v.number(),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    reservationId: v.id("videoReservations"),
    revisionId: v.id("submissionVideoRevisions"),
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const mimeType = args.mimeType.trim().toLowerCase();
    if (
      !supportedMimeTypes.has(mimeType) ||
      !Number.isSafeInteger(args.fileSizeBytes) ||
      args.fileSizeBytes <= 0 ||
      args.fileSizeBytes > maximumVideoFileBytes
    ) {
      unavailable("Choose an MP4, MOV or WebM video smaller than 512 MB.");
    }
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const reserved: {
      expiresAt: number;
      organizationId: Id<"organizations">;
      reservationId: Id<"videoReservations">;
      revisionId: Id<"submissionVideoRevisions">;
      testimonialId: Id<"testimonials">;
    } = await ctx.runMutation(
      internal.submissionManagement.reserveVideoReplacement,
      {
        clientRevisionId: `revision-${randomSubmissionManagementToken().slice(0, 32)}`,
        expectedContentVersion: args.expectedContentVersion,
        tokenHash,
      },
    );
    let directUpload: DirectUpload | undefined;
    try {
      const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000");
      directUpload = await createVideoDirectUpload({
        corsOrigin: siteUrl.origin,
        passthrough: String(reserved.reservationId),
        spokenLanguage: args.spokenLanguage,
      });
      const videoAssetId: Id<"videoAssets"> = await ctx.runMutation(
        internal.submissionManagement.attachVideoReplacement,
        {
          fileSizeBytes: args.fileSizeBytes,
          mimeType,
          provider: directUpload.provider,
          providerUploadId: directUpload.uploadId,
          reservationId: reserved.reservationId,
          revisionId: reserved.revisionId,
          spokenLanguage: args.spokenLanguage,
          tokenHash,
        },
      );
      if (directUpload.provider === "fake") {
        await ctx.runMutation(
          internal.submissionManagement.completeFakeVideoReplacement,
          { videoAssetId },
        );
      }
      return {
        expiresAt: reserved.expiresAt,
        provider: directUpload.provider,
        reservationId: reserved.reservationId,
        revisionId: reserved.revisionId,
        uploadUrl: directUpload.uploadUrl,
      };
    } catch (error) {
      try {
        if (directUpload) {
          try {
            await ctx.runMutation(
              internal.submissionManagement.recordDetachedReplacementUpload,
              {
                organizationId: reserved.organizationId,
                provider: directUpload.provider,
                providerUploadId: directUpload.uploadId,
                reservationId: reserved.reservationId,
                testimonialId: reserved.testimonialId,
              },
            );
          } catch {
            // Still attempt immediate cancellation if durable recording failed.
          }
          try {
            await cancelVideoDirectUpload(
              directUpload.uploadId,
              directUpload.provider,
            );
          } catch {
            // The durable cleanup job owns retries after this best-effort cancel.
          }
        }
      } finally {
        await ctx.runMutation(
          internal.submissionManagement.releaseVideoReplacement,
          {
            reservationId: reserved.reservationId,
            revisionId: reserved.revisionId,
          },
        );
      }
      throw error;
    }
  },
});

export const withdrawConsent = mutation({
  args: { token: v.string() },
  returns: v.object({ withdrawn: v.boolean() }),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const testimonial = await ctx.db
      .query("testimonials")
      .withIndex("by_management_token_hash", (index) =>
        index.eq("managementTokenHash", tokenHash),
      )
      .unique();
    if (!testimonial) return { withdrawn: true };
    if (
      testimonial.managementTokenExpiresAt !== undefined &&
      testimonial.managementTokenExpiresAt <= Date.now()
    ) {
      return { withdrawn: true };
    }
    const [
      consent,
      deliveries,
      projection,
      retryLinks,
      revisions,
      currentAsset,
      deletion,
      priorAuditEvents,
      replacementItems,
    ] = await Promise.all([
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("submissionEmailDeliveries")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
      ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("videoRetryLinks")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
      ctx.db
        .query("submissionVideoRevisions")
        .withIndex("by_testimonial_status", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
      testimonial.submissionType === "video"
        ? ctx.db
            .query("videoAssets")
            .withIndex("by_testimonial", (index) =>
              index.eq("testimonialId", testimonial._id),
            )
            .unique()
        : null,
      ctx.db
        .query("videoMediaDeletions")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
      ctx.db
        .query("auditEvents")
        .withIndex("by_organization_target", (index) =>
          index
            .eq("organizationId", testimonial.organizationId)
            .eq("targetType", "testimonial")
            .eq("targetId", String(testimonial._id)),
        )
        .collect(),
      ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .collect(),
    ]);
    const extraAssetIds = [
      ...retryLinks.map((link) => link.videoAssetId),
      ...revisions.flatMap((revision) =>
        revision.videoAssetId ? [revision.videoAssetId] : [],
      ),
    ];
    const extraAssets = await Promise.all(
      extraAssetIds.map((id) => ctx.db.get(id)),
    );
    const assets = [currentAsset, ...extraAssets].filter(
      (asset, index, all): asset is Doc<"videoAssets"> =>
        Boolean(asset) &&
        all.findIndex((candidate) => candidate?._id === asset?._id) === index,
    );
    for (const asset of assets) {
      await enqueueVideoAssetCleanup(ctx, asset, testimonial._id);
    }
    if (deletion) {
      for (const target of deletion.providerAssets) {
        await enqueueAssetCleanup(ctx, {
          ...target,
          organizationId: testimonial.organizationId,
          testimonialId: testimonial._id,
        });
      }
      for (const target of deletion.providerUploads ?? []) {
        await enqueueAssetCleanup(ctx, {
          ...target,
          organizationId: testimonial.organizationId,
          testimonialId: testimonial._id,
        });
      }
      await ctx.db.delete(deletion._id);
    }
    if (projection) await ctx.db.delete(projection._id);
    for (const delivery of deliveries) await ctx.db.delete(delivery._id);
    for (const retryLink of retryLinks) await ctx.db.delete(retryLink._id);
    for (const revision of revisions) {
      await ctx.db.delete(revision._id);
      const reservation = await ctx.db.get(revision.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    if (consent) await ctx.db.delete(consent._id);
    for (const asset of assets) {
      await ctx.db.delete(asset._id);
      const reservation = await ctx.db.get(asset.reservationId);
      if (reservation) await ctx.db.delete(reservation._id);
    }
    if (testimonial.avatarStorageId) {
      await ctx.storage.delete(testimonial.avatarStorageId);
    }
    for (const item of replacementItems) {
      await ctx.db.delete(item._id);
      const remaining = await ctx.db
        .query("managementLinkReplacementItems")
        .withIndex("by_request", (index) =>
          index.eq("requestId", item.requestId),
        )
        .first();
      if (!remaining) {
        const request = await ctx.db.get(item.requestId);
        if (request) await ctx.db.delete(request._id);
      }
    }
    for (const event of priorAuditEvents) {
      if (
        event.targetType === "testimonial" &&
        event.targetId === String(testimonial._id)
      ) {
        await ctx.db.delete(event._id);
      }
    }
    await ctx.db.delete(testimonial._id);
    await recordOrganizationAuditEvent(ctx, {
      actorDisplayName: "Submitter",
      actorUserId: "submitter",
      eventType: "testimonial.consent_withdrawn",
      organizationId: testimonial.organizationId,
      previousValue: testimonial.moderationStatus,
      targetId: String(testimonial._id),
      targetLabel: "Withdrawn Testimonial",
      targetType: "testimonial",
    });
    return { withdrawn: true };
  },
});

const replacementRequestWindowMs = 60 * 60 * 1_000;
const replacementRequestsPerAddressWindow = 3;
const replacementRequestsPerBrandWindow = 100;
const replacementDeliveryLeaseMs = 5 * 60 * 1_000;
const maximumReplacementDeliveryAttempts = 5;

function managementLinkTokenSecret() {
  const secret =
    process.env.MANAGEMENT_LINK_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Management-link token delivery is not configured.");
  }
  return secret;
}

export const queueReplacementLinkRequest = internalMutation({
  args: {
    email: v.string(),
    publicSlug: v.string(),
    scheduleDelivery: v.optional(v.boolean()),
  },
  returns: v.union(v.null(), v.id("managementLinkReplacementRequests")),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const publicSlug = args.publicSlug.trim().toLowerCase();
    const requestKey = await hashSubmissionManagementToken(
      `${publicSlug}:${email}`,
    );
    const now = Date.now();
    const windowStartedAt =
      Math.floor(now / replacementRequestWindowMs) * replacementRequestWindowMs;
    const targetResourceKey = `management-link:target:${requestKey}`;
    const brandResourceKey = `management-link:brand:${await hashSubmissionManagementToken(publicSlug)}`;
    const [targetBucket, brandBucket, activeRequest] = await Promise.all([
      ctx.db
        .query("publicReadRateLimitBuckets")
        .withIndex("by_resource_window", (index) =>
          index
            .eq("resourceKey", targetResourceKey)
            .eq("windowStartedAt", windowStartedAt),
        )
        .unique(),
      ctx.db
        .query("publicReadRateLimitBuckets")
        .withIndex("by_resource_window", (index) =>
          index
            .eq("resourceKey", brandResourceKey)
            .eq("windowStartedAt", windowStartedAt),
        )
        .unique(),
      ctx.db
        .query("managementLinkReplacementRequests")
        .withIndex("by_request_key", (index) =>
          index.eq("requestKey", requestKey),
        )
        .first(),
    ]);
    if (
      (activeRequest &&
        activeRequest.attempts < maximumReplacementDeliveryAttempts) ||
      (targetBucket?.count ?? 0) >= replacementRequestsPerAddressWindow ||
      (brandBucket?.count ?? 0) >= replacementRequestsPerBrandWindow
    ) {
      return null;
    }
    const expiresAt = windowStartedAt + replacementRequestWindowMs * 2;
    if (targetBucket) {
      await ctx.db.patch(targetBucket._id, { count: targetBucket.count + 1 });
    } else {
      await ctx.db.insert("publicReadRateLimitBuckets", {
        count: 1,
        expiresAt,
        resourceKey: targetResourceKey,
        windowStartedAt,
      });
    }
    if (brandBucket) {
      await ctx.db.patch(brandBucket._id, { count: brandBucket.count + 1 });
    } else {
      await ctx.db.insert("publicReadRateLimitBuckets", {
        count: 1,
        expiresAt,
        resourceKey: brandResourceKey,
        windowStartedAt,
      });
    }

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const brand = validEmail
      ? await ctx.db
          .query("organizations")
          .withIndex("by_public_slug", (index) =>
            index.eq("publicSlug", publicSlug),
          )
          .unique()
      : null;
    const availableBrand =
      brand?.deletionStartedAt === undefined ? brand : null;
    const testimonials = availableBrand
      ? await ctx.db
          .query("testimonials")
          .withIndex("by_organization_submitter_email", (index) =>
            index
              .eq("organizationId", availableBrand._id)
              .eq("submitterEmail", email),
          )
          .collect()
      : [];
    const requestId = await ctx.db.insert("managementLinkReplacementRequests", {
      attempts: 0,
      brandName: availableBrand?.name,
      createdAt: now,
      organizationId: availableBrand?._id,
      recipientEmail:
        availableBrand && testimonials.length > 0 ? email : undefined,
      requestKey,
      status: "pending",
      updatedAt: now,
    });
    if (availableBrand && testimonials.length > 0) {
      const secret = managementLinkTokenSecret();
      const items = await Promise.all(
        testimonials.map(async (testimonial) => {
          const tokenSeed = randomSubmissionManagementToken();
          const token = await deriveSubmissionManagementToken(
            secret,
            tokenSeed,
          );
          return {
            organizationId: availableBrand._id,
            requestId,
            testimonialId: testimonial._id,
            tokenHash: await hashSubmissionManagementToken(token),
            tokenSeed,
          };
        }),
      );
      await Promise.all(
        items.map((item) =>
          ctx.db.insert("managementLinkReplacementItems", {
            ...item,
            createdAt: now,
          }),
        ),
      );
    }
    if (args.scheduleDelivery !== false) {
      await ctx.scheduler.runAfter(
        0,
        internal.submissionManagement.processReplacementLinkRequest,
        { requestId },
      );
    }
    return requestId;
  },
});

export const claimReplacementLinkRequest = internalMutation({
  args: {
    leaseId: v.string(),
    requestId: v.id("managementLinkReplacementRequests"),
  },
  returns: v.union(
    v.null(),
    v.object({
      attempt: v.number(),
      brandName: v.string(),
      items: v.array(
        v.object({
          testimonialId: v.id("testimonials"),
          tokenHash: v.string(),
          tokenSeed: v.string(),
        }),
      ),
      recipientEmail: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    const now = Date.now();
    if (!request) return null;
    const items = await ctx.db
      .query("managementLinkReplacementItems")
      .withIndex("by_request", (index) => index.eq("requestId", request._id))
      .collect();
    if (!request.recipientEmail || !request.brandName || items.length === 0) {
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
      await ctx.db.delete(request._id);
      return null;
    }
    if (request.leaseExpiresAt && request.leaseExpiresAt > now) {
      return null;
    }
    if (request.attempts >= maximumReplacementDeliveryAttempts) {
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
      await ctx.db.delete(request._id);
      return null;
    }
    const attempt = request.attempts + 1;
    await ctx.db.patch(request._id, {
      attempts: attempt,
      error: undefined,
      leaseId: args.leaseId,
      leaseExpiresAt: now + replacementDeliveryLeaseMs,
      status: "sending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      replacementDeliveryLeaseMs,
      internal.submissionManagement.processReplacementLinkRequest,
      { requestId: request._id },
    );
    return {
      attempt,
      brandName: request.brandName,
      items: items.map(({ testimonialId, tokenHash, tokenSeed }) => ({
        testimonialId,
        tokenHash,
        tokenSeed,
      })),
      recipientEmail: request.recipientEmail,
    };
  },
});

export const finishReplacementLinkRequest = internalMutation({
  args: {
    error: v.optional(v.string()),
    leaseId: v.string(),
    requestId: v.id("managementLinkReplacementRequests"),
    sent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.leaseId !== args.leaseId) return null;
    const items = await ctx.db
      .query("managementLinkReplacementItems")
      .withIndex("by_request", (index) => index.eq("requestId", request._id))
      .collect();
    if (args.sent) {
      const now = Date.now();
      const replacements = await Promise.all(
        items.map(async (item) => ({
          managementTokenHash: item.tokenHash,
          testimonial: await ctx.db.get(item.testimonialId),
        })),
      );
      await Promise.all(
        replacements.map(({ managementTokenHash, testimonial }) => {
          if (
            !testimonial ||
            testimonial.organizationId !== request.organizationId ||
            testimonial.submitterEmail !== request.recipientEmail
          ) {
            return Promise.resolve();
          }
          return ctx.db.patch(testimonial._id, {
            managementTokenExpiresAt: undefined,
            managementTokenHash,
            updatedAt: now,
          });
        }),
      );
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
      await ctx.db.delete(request._id);
      return null;
    }
    if (request.attempts >= maximumReplacementDeliveryAttempts) {
      await Promise.all(items.map((item) => ctx.db.delete(item._id)));
      await ctx.db.delete(request._id);
      return null;
    }
    await ctx.db.patch(request._id, {
      error: args.error,
      leaseId: undefined,
      leaseExpiresAt: undefined,
      status: "failed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const processReplacementLinkRequest = internalAction({
  args: { requestId: v.id("managementLinkReplacementRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaseId = crypto.randomUUID();
    const delivery = await ctx.runMutation(
      internal.submissionManagement.claimReplacementLinkRequest,
      { leaseId, requestId: args.requestId },
    );
    if (!delivery) return null;
    try {
      const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(
        /\/$/,
        "",
      );
      const secret = managementLinkTokenSecret();
      const tokens = await Promise.all(
        delivery.items.map(async ({ tokenHash, tokenSeed }) => {
          const token = await deriveSubmissionManagementToken(
            secret,
            tokenSeed,
          );
          if ((await hashSubmissionManagementToken(token)) !== tokenHash) {
            throw new Error("Management-link token integrity check failed.");
          }
          return token;
        }),
      );
      await sendTransactionalEmail({
        ...buildReplacementManagementLinkEmail({
          brandName: delivery.brandName,
          email: delivery.recipientEmail,
          urls: tokens.map(
            (token) => `${siteUrl}/s/${encodeURIComponent(token)}`,
          ),
        }),
        idempotencyKey: `management-link/${String(args.requestId)}`,
      });
      await ctx.runMutation(
        internal.submissionManagement.finishReplacementLinkRequest,
        { leaseId, requestId: args.requestId, sent: true },
      );
    } catch (error) {
      await ctx.runMutation(
        internal.submissionManagement.finishReplacementLinkRequest,
        {
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Management-link delivery failed.",
          leaseId,
          requestId: args.requestId,
          sent: false,
        },
      );
      if (delivery.attempt < maximumReplacementDeliveryAttempts) {
        await ctx.scheduler.runAfter(
          Math.min(30_000 * 2 ** (delivery.attempt - 1), 15 * 60_000),
          internal.submissionManagement.processReplacementLinkRequest,
          args,
        );
      }
    }
    return null;
  },
});

export const requestReplacementLink = action({
  args: { email: v.string(), publicSlug: v.string() },
  returns: v.object({ accepted: v.literal(true) }),
  handler: async (ctx, args) => {
    await ctx.runMutation(
      internal.submissionManagement.queueReplacementLinkRequest,
      args,
    );
    return { accepted: true as const };
  },
});
