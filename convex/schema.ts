import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    publicSlug: v.string(),
    publicSlugChangedAt: v.optional(v.number()),
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.string(),
    collectionFormTitle: v.string(),
    collectionFormDescription: v.string(),
    privacyContact: v.string(),
    newSubmissionEmailNotificationsEnabled: v.optional(v.boolean()),
    createdByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_public_slug", ["publicSlug"])
    .index("by_logo_storage_id", ["logoStorageId"]),
  userProfiles: defineTable({
    userId: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_avatar_storage_id", ["avatarStorageId"]),
  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deactivatedAt: v.optional(v.number()),
  })
    .index("by_organization_user", ["organizationId", "userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_organization_status", ["organizationId", "status"]),
  billingProfiles: defineTable({
    organizationId: v.id("organizations"),
    billingEmail: v.string(),
    contactUpdateEmail: v.optional(v.string()),
    contactUpdateId: v.optional(v.string()),
    contactUpdateLeaseId: v.optional(v.string()),
    contactUpdateLeaseExpiresAt: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    checkoutReservationId: v.optional(v.string()),
    checkoutLeaseId: v.optional(v.string()),
    checkoutLeaseExpiresAt: v.optional(v.number()),
    checkoutLookupKey: v.optional(
      v.union(v.literal("premium_monthly"), v.literal("premium_annual")),
    ),
    stripeCheckoutSessionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),
  projects: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdByUserId: v.string(),
    updatedByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"]),
  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("editor"), v.literal("viewer")),
    tokenHash: v.string(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    deliveryStatus: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    deliveryIdempotencyKey: v.string(),
    deliveryProvider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    deliveryError: v.optional(v.string()),
    invitedByUserId: v.string(),
    acceptedByUserId: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_organization_email_status", [
      "organizationId",
      "email",
      "status",
    ])
    .index("by_token_hash", ["tokenHash"]),
  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    eventType: v.union(
      v.literal("organization.created"),
      v.literal("organization.renamed"),
      v.literal("brand.public_slug_changed"),
      v.literal("organization.logo_updated"),
      v.literal("organization.logo_removed"),
      v.literal("invitation.created"),
      v.literal("invitation.resent"),
      v.literal("invitation.role_changed"),
      v.literal("invitation.revoked"),
      v.literal("invitation.accepted"),
      v.literal("membership.activated"),
      v.literal("membership.role_changed"),
      v.literal("membership.removed"),
      v.literal("membership.left"),
      v.literal("project.created"),
      v.literal("project.updated"),
      v.literal("project.archived"),
      v.literal("project.deleted"),
      v.literal("billing.contact_updated"),
      v.literal("billing.checkout_started"),
      v.literal("billing.portal_opened"),
      v.literal("testimonial.published"),
      v.literal("testimonial.archived"),
      v.literal("testimonial.deleted"),
    ),
    actorUserId: v.string(),
    actorDisplayName: v.string(),
    targetType: v.union(
      v.literal("organization"),
      v.literal("invitation"),
      v.literal("membership"),
      v.literal("project"),
      v.literal("billing"),
      v.literal("testimonial"),
    ),
    targetId: v.string(),
    targetLabel: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    occurredAt: v.number(),
  }).index("by_organization_occurred_at", ["organizationId", "occurredAt"]),
  testimonials: defineTable({
    organizationId: v.id("organizations"),
    clientSubmissionId: v.string(),
    submissionType: v.union(v.literal("text"), v.literal("video")),
    moderationStatus: v.union(
      v.literal("pending"),
      v.literal("published"),
      v.literal("archived"),
      v.literal("spam"),
    ),
    text: v.string(),
    submitterName: v.string(),
    submitterEmail: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    managementTokenHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_organization_status", ["organizationId", "moderationStatus"])
    .index("by_organization_created_at", ["organizationId", "createdAt"])
    .index("by_management_token_hash", ["managementTokenHash"])
    .index("by_avatar_storage_id", ["avatarStorageId"]),
  publicTestimonialProjections: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    type: v.literal("text"),
    text: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    publishedAt: v.number(),
  })
    .index("by_organization_published_at", ["organizationId", "publishedAt"])
    .index("by_testimonial", ["testimonialId"]),
  publicReadRateLimitBuckets: defineTable({
    resourceKey: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
    expiresAt: v.number(),
  })
    .index("by_resource_window", ["resourceKey", "windowStartedAt"])
    .index("by_expires_at", ["expiresAt"]),
  publicationConsents: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    brandName: v.string(),
    consentText: v.string(),
    consentVersion: v.string(),
    identityFields: v.array(
      v.union(
        v.literal("name"),
        v.literal("avatar"),
        v.literal("role"),
        v.literal("company"),
        v.literal("rating"),
      ),
    ),
    acceptedAt: v.number(),
  })
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"]),
  submissionEmailDeliveries: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    recipientKind: v.union(v.literal("submitter"), v.literal("owner")),
    recipientEmail: v.string(),
    attemptId: v.string(),
    attemptLeaseExpiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("uncertain"),
    ),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_testimonial_recipient", ["testimonialId", "recipientKind"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"]),
  submissionAvatarUploads: defineTable({
    organizationId: v.id("organizations"),
    clientSubmissionId: v.string(),
    storageId: v.optional(v.id("_storage")),
    uploadAttempts: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_organization", ["organizationId"])
    .index("by_storage_id", ["storageId"])
    .index("by_expiry", ["expiresAt"]),
  videoReservations: defineTable({
    organizationId: v.id("organizations"),
    clientSubmissionId: v.string(),
    plan: v.union(v.literal("free"), v.literal("premium")),
    status: v.union(
      v.literal("reserved"),
      v.literal("consumed"),
      v.literal("released"),
    ),
    expiresAt: v.number(),
    providerUploadId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_provider_upload_id", ["providerUploadId"])
    .index("by_expiry", ["expiresAt"]),
  videoAssets: defineTable({
    organizationId: v.id("organizations"),
    reservationId: v.id("videoReservations"),
    testimonialId: v.optional(v.id("testimonials")),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.string(),
    providerAssetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    spokenLanguage: v.union(v.literal("en"), v.literal("fr")),
    mimeType: v.string(),
    fileSizeBytes: v.number(),
    durationSeconds: v.optional(v.number()),
    status: v.union(
      v.literal("awaiting_upload"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    captionsStatus: v.union(
      v.literal("requested"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reservation", ["reservationId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_provider_upload_id", ["providerUploadId"])
    .index("by_provider_asset_id", ["providerAssetId"])
    .index("by_organization_status", ["organizationId", "status"]),
  videoWebhookEvents: defineTable({
    providerEventId: v.string(),
    eventType: v.string(),
    outcome: v.string(),
    processedAt: v.number(),
  }).index("by_provider_event_id", ["providerEventId"]),
  videoRetryLinks: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    videoAssetId: v.id("videoAssets"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    replacementReservationId: v.optional(v.id("videoReservations")),
    tokenSeed: v.optional(v.string()),
    deliveryAttempts: v.optional(v.number()),
    deliveryStatus: v.optional(
      v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    ),
    deliveryLeaseId: v.optional(v.string()),
    deliveryLeaseExpiresAt: v.optional(v.number()),
    deliveryError: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_video_asset", ["videoAssetId"]),
  storageCleanupJobs: defineTable({
    attemptId: v.string(),
    key: v.literal("submission-avatar-orphans"),
    leaseExpiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
