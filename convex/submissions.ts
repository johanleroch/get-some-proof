import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import {
  assertPublicationConsentSnapshot,
  buildSubmissionEmailIdempotencyKey,
  buildPublicationConsent,
  hashSubmissionManagementToken,
  normalizeTextSubmission,
  randomSubmissionManagementToken,
} from "./domain/submission";
import { authzForOrganization } from "./authorization";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import {
  sendTransactionalEmail,
  UncertainEmailDeliveryError,
} from "./email/provider";
import {
  buildNewPendingTestimonialEmail,
  buildSubmissionConfirmationEmail,
} from "./email/templates";
import { requireOrganizationPermission } from "./security/organizationAccess";

const textSubmissionArgs = {
  ageConfirmed: v.boolean(),
  avatarReservationId: v.optional(v.id("submissionAvatarUploads")),
  avatarStorageId: v.optional(v.id("_storage")),
  clientSubmissionId: v.string(),
  company: v.optional(v.string()),
  consentText: v.string(),
  consentVersion: v.string(),
  consentAccepted: v.boolean(),
  publicSlug: v.string(),
  rating: v.optional(v.number()),
  role: v.optional(v.string()),
  submitterEmail: v.string(),
  submitterName: v.string(),
  text: v.string(),
};

const submissionResult = v.object({
  moderationStatus: v.literal("pending"),
  testimonialId: v.id("testimonials"),
});

const emailAttemptLeaseMs = 5 * 60 * 1_000;
const avatarReservationTtlMs = 60 * 60 * 1_000;
const orphanedStorageMinimumAgeMs = 2 * 60 * 60 * 1_000;
const avatarCleanupDelayMs = 3 * 60 * 60 * 1_000;
const storageCleanupLeaseMs = 60 * 60 * 1_000;
const maximumActiveAvatarReservations = 50;
const maximumAvatarUploadAttempts = 3;

type CreatedTextRecords = {
  brandName: string;
  shouldDeliver: boolean;
  dashboardPath: string;
  deliveries: Array<{
    deliveryId: Id<"submissionEmailDeliveries">;
    attemptId: string;
    recipientEmail: string;
    recipientKind: "submitter" | "owner";
  }>;
  moderationStatus: "pending";
  submitterName: string;
  testimonialId: Id<"testimonials">;
  testimonialText: string;
};

type SubmissionActionResult = {
  moderationStatus: "pending";
  testimonialId: Id<"testimonials">;
};

function collectionUnavailable(): never {
  throw new ConvexError({
    code: "COLLECTION_FORM_UNAVAILABLE",
    message: "Collection Form unavailable.",
  });
}

function normalizeClientSubmissionId(value: string) {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(normalized)) {
    throw new ConvexError({
      code: "INVALID_SUBMISSION",
      message: "Submission could not be confirmed. Refresh and try again.",
    });
  }
  return normalized;
}

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

export const generateAvatarUploadUrl = mutation({
  args: { clientSubmissionId: v.string(), publicSlug: v.string() },
  returns: v.object({
    reservationId: v.id("submissionAvatarUploads"),
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", args.publicSlug.trim().toLowerCase()),
      )
      .unique();
    if (!brand) collectionUnavailable();
    const clientSubmissionId = normalizeClientSubmissionId(
      args.clientSubmissionId,
    );
    const existing = await ctx.db
      .query("submissionAvatarUploads")
      .withIndex("by_organization_client_submission", (index) =>
        index
          .eq("organizationId", brand._id)
          .eq("clientSubmissionId", clientSubmissionId),
      )
      .unique();
    const now = Date.now();
    if (existing?.uploadAttempts === maximumAvatarUploadAttempts) {
      throw new ConvexError({
        code: "AVATAR_UPLOAD_LIMIT_REACHED",
        message: "Avatar upload limit reached. Refresh and try again later.",
      });
    }
    if (!existing) {
      const activeReservations = await ctx.db
        .query("submissionAvatarUploads")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", brand._id),
        )
        .filter((queryFilter) =>
          queryFilter.gt(queryFilter.field("expiresAt"), now),
        )
        .take(maximumActiveAvatarReservations);
      if (activeReservations.length === maximumActiveAvatarReservations) {
        throw new ConvexError({
          code: "AVATAR_UPLOAD_LIMIT_REACHED",
          message:
            "Avatar uploads are temporarily unavailable. Try again later.",
        });
      }
    }
    const expiresAt = now + avatarReservationTtlMs;
    const reservationId = existing
      ? existing._id
      : await ctx.db.insert("submissionAvatarUploads", {
          clientSubmissionId,
          createdAt: now,
          expiresAt,
          organizationId: brand._id,
          uploadAttempts: 1,
          updatedAt: now,
        });
    if (existing) {
      if (existing.storageId) await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, {
        expiresAt,
        storageId: undefined,
        uploadAttempts: existing.uploadAttempts + 1,
        updatedAt: now,
      });
    }
    await ctx.scheduler.runAfter(
      avatarCleanupDelayMs,
      internal.submissions.expireAvatarUpload,
      { reservationId },
    );
    return {
      reservationId,
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
});

export const registerAvatarUpload = mutation({
  args: {
    reservationId: v.id("submissionAvatarUploads"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.expiresAt <= Date.now()) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "AVATAR_UPLOAD_UNAVAILABLE",
        message: "Avatar upload expired. Try again.",
      });
    }
    await validateExclusiveStoredImage(ctx, args.storageId, {
      kind: "testimonial",
    });
    if (reservation.storageId && reservation.storageId !== args.storageId) {
      await ctx.storage.delete(reservation.storageId);
    }
    await ctx.db.patch(reservation._id, {
      storageId: args.storageId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const expireAvatarUpload = internalMutation({
  args: { reservationId: v.id("submissionAvatarUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    const now = Date.now();
    if (reservation && reservation.expiresAt <= now) {
      if (reservation.storageId)
        await ctx.storage.delete(reservation.storageId);
      await ctx.db.delete(reservation._id);
    }
    const cleanupKey = "submission-avatar-orphans" as const;
    const existingCleanup = await ctx.db
      .query("storageCleanupJobs")
      .withIndex("by_key", (index) => index.eq("key", cleanupKey))
      .unique();
    if (existingCleanup && existingCleanup.leaseExpiresAt > now) return null;
    const cleanupAttemptId = randomSubmissionManagementToken();
    const cleanupJobId = existingCleanup
      ? existingCleanup._id
      : await ctx.db.insert("storageCleanupJobs", {
          attemptId: cleanupAttemptId,
          createdAt: now,
          key: cleanupKey,
          leaseExpiresAt: now + storageCleanupLeaseMs,
          updatedAt: now,
        });
    if (existingCleanup) {
      await ctx.db.patch(existingCleanup._id, {
        attemptId: cleanupAttemptId,
        leaseExpiresAt: now + storageCleanupLeaseMs,
        updatedAt: now,
      });
    }
    await ctx.scheduler.runAfter(
      0,
      internal.submissions.cleanupUnreferencedAvatarStorage,
      { attemptId: cleanupAttemptId, cleanupJobId },
    );
    return null;
  },
});

export const cleanupUnreferencedAvatarStorage = internalMutation({
  args: {
    attemptId: v.string(),
    cleanupJobId: v.id("storageCleanupJobs"),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cleanupJob = await ctx.db.get(args.cleanupJobId);
    if (!cleanupJob || cleanupJob.attemptId !== args.attemptId) return null;
    await ctx.db.patch(cleanupJob._id, {
      leaseExpiresAt: Date.now() + storageCleanupLeaseMs,
      updatedAt: Date.now(),
    });
    const storedFiles = await ctx.db.system
      .query("_storage")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: 50 });
    for (const storedFile of storedFiles.page) {
      if (storedFile._creationTime > Date.now() - orphanedStorageMinimumAgeMs)
        continue;
      const [profile, organization, testimonial, uploadReservation] =
        await Promise.all([
          ctx.db
            .query("userProfiles")
            .withIndex("by_avatar_storage_id", (index) =>
              index.eq("avatarStorageId", storedFile._id),
            )
            .first(),
          ctx.db
            .query("organizations")
            .withIndex("by_logo_storage_id", (index) =>
              index.eq("logoStorageId", storedFile._id),
            )
            .first(),
          ctx.db
            .query("testimonials")
            .withIndex("by_avatar_storage_id", (index) =>
              index.eq("avatarStorageId", storedFile._id),
            )
            .first(),
          ctx.db
            .query("submissionAvatarUploads")
            .withIndex("by_storage_id", (index) =>
              index.eq("storageId", storedFile._id),
            )
            .first(),
        ]);
      if (!profile && !organization && !testimonial && !uploadReservation) {
        await ctx.storage.delete(storedFile._id);
      }
    }
    if (!storedFiles.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.submissions.cleanupUnreferencedAvatarStorage,
        {
          attemptId: args.attemptId,
          cleanupJobId: cleanupJob._id,
          cursor: storedFiles.continueCursor,
        },
      );
    } else {
      await ctx.db.delete(cleanupJob._id);
    }
    return null;
  },
});

export const createTextRecords = internalMutation({
  args: {
    ...textSubmissionArgs,
    deliveryAttemptId: v.string(),
    managementTokenHash: v.string(),
  },
  returns: v.object({
    brandName: v.string(),
    shouldDeliver: v.boolean(),
    dashboardPath: v.string(),
    deliveries: v.array(
      v.object({
        deliveryId: v.id("submissionEmailDeliveries"),
        attemptId: v.string(),
        recipientEmail: v.string(),
        recipientKind: v.union(v.literal("submitter"), v.literal("owner")),
      }),
    ),
    moderationStatus: v.literal("pending"),
    submitterName: v.string(),
    testimonialId: v.id("testimonials"),
    testimonialText: v.string(),
  }),
  handler: async (ctx, args): Promise<CreatedTextRecords> => {
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (index) =>
        index.eq("publicSlug", args.publicSlug.trim().toLowerCase()),
      )
      .unique();
    if (!brand) collectionUnavailable();

    const clientSubmissionId = normalizeClientSubmissionId(
      args.clientSubmissionId,
    );
    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_organization_client_submission", (index) =>
        index
          .eq("organizationId", brand._id)
          .eq("clientSubmissionId", clientSubmissionId),
      )
      .unique();
    if (existing) {
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
      const submitterRetry = retryable.some(
        (delivery) => delivery.recipientKind === "submitter",
      );
      if (submitterRetry) {
        await ctx.db.patch(existing._id, {
          managementTokenHash: args.managementTokenHash,
          updatedAt: Date.now(),
        });
      }
      for (const delivery of retryable) {
        await ctx.db.patch(delivery._id, {
          error: undefined,
          attemptId: args.deliveryAttemptId,
          attemptLeaseExpiresAt: Date.now() + emailAttemptLeaseMs,
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
          deliveryId: delivery._id,
          attemptId: args.deliveryAttemptId,
          recipientEmail:
            delivery.recipientKind === "owner" && currentOwnerEmail
              ? currentOwnerEmail
              : delivery.recipientEmail,
          recipientKind: delivery.recipientKind,
        })),
        moderationStatus: "pending" as const,
        shouldDeliver: retryable.length > 0,
        submitterName: existing.submitterName,
        testimonialId: existing._id,
        testimonialText: existing.text,
      };
    }

    let submission: ReturnType<typeof normalizeTextSubmission>;
    try {
      submission = normalizeTextSubmission({
        ageConfirmed: args.ageConfirmed,
        company: args.company,
        consentAccepted: args.consentAccepted,
        email: args.submitterEmail,
        name: args.submitterName,
        rating: args.rating,
        role: args.role,
        text: args.text,
      });
    } catch (error) {
      throw new ConvexError({
        code: "INVALID_SUBMISSION",
        message: error instanceof Error ? error.message : "Invalid Submission.",
      });
    }
    if (args.avatarStorageId) {
      const reservation = args.avatarReservationId
        ? await ctx.db.get(args.avatarReservationId)
        : null;
      if (
        !reservation ||
        reservation.organizationId !== brand._id ||
        reservation.clientSubmissionId !== clientSubmissionId ||
        reservation.storageId !== args.avatarStorageId ||
        reservation.expiresAt <= Date.now()
      ) {
        throw new ConvexError({
          code: "AVATAR_UPLOAD_UNAVAILABLE",
          message: "Avatar upload unavailable. Upload it again.",
        });
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
        company: submission.company,
        name: submission.name,
        rating: submission.rating,
        role: submission.role,
      },
    });
    try {
      assertPublicationConsentSnapshot(consent, {
        text: args.consentText,
        version: args.consentVersion,
      });
    } catch (error) {
      throw new ConvexError({
        code: "CONSENT_CHANGED",
        message:
          error instanceof Error
            ? error.message
            : "Publication Consent changed.",
      });
    }
    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      avatarStorageId: args.avatarStorageId,
      clientSubmissionId,
      company: submission.company,
      managementTokenHash: args.managementTokenHash,
      moderationStatus: "pending",
      organizationId: brand._id,
      rating: submission.rating,
      role: submission.role,
      submissionType: "text",
      submitterEmail: submission.email,
      submitterName: submission.name,
      text: submission.text,
      createdAt: now,
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
    if (args.avatarReservationId) {
      await ctx.db.delete(args.avatarReservationId);
    }

    const deliveries: Array<{
      deliveryId: Id<"submissionEmailDeliveries">;
      attemptId: string;
      recipientEmail: string;
      recipientKind: "submitter" | "owner";
    }> = [];
    const submitterDeliveryId = await ctx.db.insert(
      "submissionEmailDeliveries",
      {
        attemptId: args.deliveryAttemptId,
        attemptLeaseExpiresAt: now + emailAttemptLeaseMs,
        createdAt: now,
        organizationId: brand._id,
        recipientEmail: submission.email,
        recipientKind: "submitter",
        status: "pending",
        testimonialId,
        updatedAt: now,
      },
    );
    deliveries.push({
      deliveryId: submitterDeliveryId,
      attemptId: args.deliveryAttemptId,
      recipientEmail: submission.email,
      recipientKind: "submitter",
    });

    if (brand.newSubmissionEmailNotificationsEnabled !== false) {
      const ownerEmail = await findCurrentOwnerEmail(ctx, brand._id);
      if (ownerEmail) {
        const ownerDeliveryId = await ctx.db.insert(
          "submissionEmailDeliveries",
          {
            createdAt: now,
            attemptId: args.deliveryAttemptId,
            attemptLeaseExpiresAt: now + emailAttemptLeaseMs,
            organizationId: brand._id,
            recipientEmail: ownerEmail,
            recipientKind: "owner",
            status: "pending",
            testimonialId,
            updatedAt: now,
          },
        );
        deliveries.push({
          deliveryId: ownerDeliveryId,
          attemptId: args.deliveryAttemptId,
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
      shouldDeliver: true,
      submitterName: submission.name,
      testimonialId,
      testimonialText: submission.text,
    };
  },
});

export const recordEmailDelivery = internalMutation({
  args: {
    deliveryId: v.id("submissionEmailDeliveries"),
    attemptId: v.string(),
    error: v.optional(v.string()),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("uncertain"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (
      !delivery ||
      delivery.status !== "pending" ||
      delivery.attemptId !== args.attemptId
    )
      return null;
    await ctx.db.patch(delivery._id, {
      error: args.error,
      provider: args.provider,
      providerMessageId: args.providerMessageId,
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

async function deliverEmails(
  ctx: ActionCtx,
  created: {
    brandName: string;
    dashboardPath: string;
    deliveries: Array<{
      deliveryId: Id<"submissionEmailDeliveries">;
      attemptId: string;
      recipientEmail: string;
      recipientKind: "submitter" | "owner";
    }>;
    submitterName: string;
    testimonialText: string;
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
          ? buildSubmissionConfirmationEmail({
              brandName: created.brandName,
              email: delivery.recipientEmail,
              testimonialText: created.testimonialText,
              url: `${siteUrl}/s/${encodeURIComponent(managementToken)}`,
            })
          : buildNewPendingTestimonialEmail({
              brandName: created.brandName,
              email: delivery.recipientEmail,
              submissionType: "text",
              submitterName: created.submitterName,
              url: `${siteUrl}${created.dashboardPath}`,
            });
      const idempotentMessage = {
        ...message,
        idempotencyKey: buildSubmissionEmailIdempotencyKey(
          delivery.attemptId,
          String(delivery.deliveryId),
        ),
      };
      let receipt: Awaited<ReturnType<typeof sendTransactionalEmail>>;
      try {
        receipt = await sendTransactionalEmail(idempotentMessage);
      } catch (error) {
        try {
          await ctx.runMutation(internal.submissions.recordEmailDelivery, {
            deliveryId: delivery.deliveryId,
            attemptId: delivery.attemptId,
            error:
              error instanceof Error
                ? error.message.slice(0, 200)
                : "Delivery failed.",
            status:
              error instanceof UncertainEmailDeliveryError
                ? "uncertain"
                : "failed",
          });
        } catch {
          // Preserve the Pending attempt when even recording the outcome fails.
        }
        return;
      }
      try {
        await ctx.runMutation(internal.submissions.recordEmailDelivery, {
          deliveryId: delivery.deliveryId,
          attemptId: delivery.attemptId,
          provider: receipt.provider,
          providerMessageId: receipt.providerMessageId,
          status: "sent",
        });
      } catch {
        // A provider receipt exists. Leaving this attempt Pending prevents a
        // replay from sending a duplicate or invalidating the delivered link.
      }
    }),
  );
}

export const submitText = action({
  args: textSubmissionArgs,
  returns: submissionResult,
  handler: async (ctx, args): Promise<SubmissionActionResult> => {
    const managementToken = randomSubmissionManagementToken();
    const deliveryAttemptId = randomSubmissionManagementToken();
    const created: CreatedTextRecords = await ctx.runMutation(
      internal.submissions.createTextRecords,
      {
        ...args,
        deliveryAttemptId,
        managementTokenHash:
          await hashSubmissionManagementToken(managementToken),
      },
    );
    if (created.shouldDeliver)
      await deliverEmails(ctx, created, managementToken);
    return {
      moderationStatus: "pending" as const,
      testimonialId: created.testimonialId,
    };
  },
});

export const getPrivate = query({
  args: {
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
  },
  returns: v.object({
    company: v.optional(v.string()),
    consentAcceptedAt: v.number(),
    consentText: v.string(),
    moderationStatus: v.union(
      v.literal("pending"),
      v.literal("published"),
      v.literal("archived"),
      v.literal("spam"),
    ),
    rating: v.optional(v.number()),
    role: v.optional(v.string()),
    submissionType: v.union(v.literal("text"), v.literal("video")),
    submitterEmail: v.string(),
    submitterName: v.string(),
    testimonialId: v.id("testimonials"),
    text: v.string(),
  }),
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
      throw new ConvexError({
        code: "TESTIMONIAL_UNAVAILABLE",
        message: "Testimonial unavailable.",
      });
    }
    const consent = await ctx.db
      .query("publicationConsents")
      .withIndex("by_testimonial", (index) =>
        index.eq("testimonialId", testimonial._id),
      )
      .unique();
    if (!consent) {
      throw new ConvexError({
        code: "TESTIMONIAL_UNAVAILABLE",
        message: "Testimonial unavailable.",
      });
    }
    return {
      company: testimonial.company,
      consentAcceptedAt: consent.acceptedAt,
      consentText: consent.consentText,
      moderationStatus: testimonial.moderationStatus,
      rating: testimonial.rating,
      role: testimonial.role,
      submissionType: testimonial.submissionType,
      submitterEmail: testimonial.submitterEmail,
      submitterName: testimonial.submitterName,
      testimonialId: testimonial._id,
      text: testimonial.text,
    };
  },
});

export const getByManagementToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      brandName: v.string(),
      company: v.optional(v.string()),
      consentAcceptedAt: v.number(),
      moderationStatus: v.union(
        v.literal("pending"),
        v.literal("published"),
        v.literal("archived"),
        v.literal("spam"),
      ),
      rating: v.optional(v.number()),
      role: v.optional(v.string()),
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
    if (!testimonial) return null;
    const [brand, consent] = await Promise.all([
      ctx.db.get(testimonial.organizationId),
      ctx.db
        .query("publicationConsents")
        .withIndex("by_testimonial", (index) =>
          index.eq("testimonialId", testimonial._id),
        )
        .unique(),
    ]);
    if (!brand || !consent) return null;
    return {
      brandName: brand.name,
      company: testimonial.company,
      consentAcceptedAt: consent.acceptedAt,
      moderationStatus: testimonial.moderationStatus,
      rating: testimonial.rating,
      role: testimonial.role,
      submitterEmail: testimonial.submitterEmail,
      submitterName: testimonial.submitterName,
      text: testimonial.text,
    };
  },
});

export const pendingCount = query({
  args: { organizationId: v.id("organizations") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "organization:read",
    );
    const pending = await ctx.db
      .query("testimonials")
      .withIndex("by_organization_status", (index) =>
        index
          .eq("organizationId", access.organization._id)
          .eq("moderationStatus", "pending"),
      )
      .collect();
    return pending.length;
  },
});
