import { testimonialSourceValidator } from "./domain/testimonialSource";
import { widgetSnapshotValidator } from "./domain/widgets";
import { mediaDeletionProgress } from "./domain/mediaDeletionProgress";
import { richTextValidator } from "./domain/testimonialRichText";
import { imageAssetKind, imageAssetSource } from "./domain/imageAsset";
import { directImageTarget } from "./domain/directImageUpload";
import {
  importResult,
  importOrigin,
  importProvider,
  wallCandidate,
  wallProvider,
} from "./domain/testimonialImport";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { importChannel, importStage } from "./domain/testimonialImport";

export default defineSchema({
  googleBusinessConnections: defineTable({
    organizationId: v.id("organizations"),
    ownerId: v.string(),
    generation: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    stateHash: v.optional(v.string()),
    verifier: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_stateHash", ["stateHash"]),
  imageAssets: defineTable({
    storageId: v.optional(v.id("_storage")),
    organizationId: v.optional(v.id("organizations")),
    ownerUserId: v.optional(v.string()),
    testimonialId: v.optional(v.id("testimonials")),
    testimonialImageId: v.optional(v.id("testimonialImages")),
    kind: imageAssetKind,
    contentType: v.literal("image/webp"),
    width: v.number(),
    height: v.number(),
    size: v.number(),
    originalContentType: v.string(),
    originalSize: v.number(),
    source: imageAssetSource,
    transformVersion: v.literal("webp-v1"),
    status: v.union(v.literal("attached"), v.literal("deleted")),
    createdAt: v.number(),
    attachedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_storage_id", ["storageId"])
    .index("by_organization_and_kind", ["organizationId", "kind"])
    .index("by_owner_user_and_kind", ["ownerUserId", "kind"])
    .index("by_testimonial_and_kind", ["testimonialId", "kind"])
    .index("by_status", ["status"]),
  imageAssetMigrationJobs: defineTable({
    referenceTable: v.union(
      v.literal("userProfiles"),
      v.literal("organizations"),
      v.literal("testimonialSubmitterPhoto"),
      v.literal("testimonialPoster"),
      v.literal("testimonialImages"),
    ),
    referenceId: v.string(),
    storageId: v.id("_storage"),
    kind: imageAssetKind,
    organizationId: v.optional(v.id("organizations")),
    ownerUserId: v.optional(v.string()),
    testimonialId: v.optional(v.id("testimonials")),
    testimonialImageId: v.optional(v.id("testimonialImages")),
    status: v.union(
      v.literal("queued"),
      v.literal("complete"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    diagnostic: v.optional(v.string()),
    replacementStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reference_table_and_reference_id", [
      "referenceTable",
      "referenceId",
    ])
    .index("by_organization_id", ["organizationId"])
    .index("by_owner_user_id", ["ownerUserId"])
    .index("by_status", ["status"]),
  directImageVerifications: defineTable({
    target: directImageTarget,
    organizationId: v.optional(v.id("organizations")),
    ownerUserId: v.optional(v.string()),
    storageId: v.id("_storage"),
    metadata: v.object({
      contentType: v.literal("image/webp"),
      height: v.number(),
      kind: imageAssetKind,
      originalContentType: v.string(),
      originalSize: v.number(),
      size: v.number(),
      source: imageAssetSource,
      transformVersion: v.literal("webp-v1"),
      width: v.number(),
    }),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_expires_at", ["expiresAt"])
    .index("by_organization_id", ["organizationId"])
    .index("by_owner_user_id", ["ownerUserId"])
    .index("by_storage_id", ["storageId"]),
  widgetFonts: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),
  widgets: defineTable({
    organizationId: v.id("organizations"),
    publicId: v.string(),
    name: v.string(),
    draft: widgetSnapshotValidator,
    published: v.optional(widgetSnapshotValidator),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_publicId", ["publicId"]),
  assistantImportUploads: defineTable({
    actorId: v.string(),
    jobId: v.id("testimonialImportJobs"),
    itemId: v.id("testimonialImportItems"),
    assetId: v.id("videoAssets"),
    requestId: v.string(),
    token: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    grant: v.optional(
      v.object({
        actorId: v.string(),
        clientId: v.string(),
        issuedAt: v.number(),
        generation: v.optional(v.number()),
        scope: v.optional(v.string()),
        verifiedAt: v.number(),
        expiresAt: v.number(),
      }),
    ),
    totalBytes: v.number(),
    mimeType: v.string(),
    offset: v.number(),
    status: v.union(
      v.literal("preparing"),
      v.literal("uploading"),
      v.literal("finalizing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    providerUploadUrl: v.optional(v.string()),
    creationStartedAt: v.number(),
    pending: v.optional(
      v.object({
        offset: v.number(),
        length: v.number(),
        digest: v.string(),
        final: v.boolean(),
      }),
    ),
    previous: v.optional(
      v.object({ offset: v.number(), length: v.number(), digest: v.string() }),
    ),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_itemId_and_requestId", ["itemId", "requestId"]),
  assistantImportMigrations: defineTable({
    organizationId: v.id("organizations"),
    actorId: v.string(),
    clientId: v.string(),
    sourceUrl: v.string(),
    discoveredCount: v.number(),
    processedCount: v.number(),
    batchCount: v.number(),
    result: importResult,
  }).index("by_organizationId_and_clientId", ["organizationId", "clientId"]),
  assistantImportMigrationSources: defineTable({
    migrationId: v.id("assistantImportMigrations"),
    sourceId: v.string(),
  }).index("by_migrationId_and_sourceId", ["migrationId", "sourceId"]),
  assistantImportActivations: defineTable({
    actorId: v.string(),
    acceptedAt: v.number(),
    version: v.string(),
    text: v.string(),
  }).index("by_actorId", ["actorId"]),
  importAcquisitionFlows: defineTable({
    channel: importChannel,
    stages: v.array(importStage),
    expiresAt: v.number(),
  }),
  importAcquisitionDaily: defineTable({
    day: v.string(),
    channel: importChannel,
    stage: importStage,
    count: v.number(),
  }).index("by_day_channel_stage", ["day", "channel", "stage"]),
  importAvatarUploads: defineTable({
    storageId: v.id("_storage"),
    expiresAt: v.number(),
  }).index("by_storage_id", ["storageId"]),
  anonymousWallPreviews: defineTable({
    identityCorrections: v.optional(
      v.array(
        v.object({
          position: v.number(),
          avatarStorageId: v.optional(v.union(v.null(), v.id("_storage"))),
          authorName: v.string(),
          tagline: v.string(),
          editedAt: v.number(),
        }),
      ),
    ),
    acquisitionFlowId: v.optional(v.id("importAcquisitionFlows")),
    tokenHash: v.string(),
    provider: wallProvider,
    sourceUrl: v.string(),
    items: v.array(wallCandidate),
    selectedPositions: v.array(v.number()),
    createdAt: v.number(),
    expiresAt: v.number(),
    claimedBy: v.optional(v.string()),
    claimedJobId: v.optional(v.id("testimonialImportJobs")),
    claimedOrganizationId: v.optional(v.id("organizations")),
  }).index("by_tokenHash", ["tokenHash"]),
  testimonialImportJobs: defineTable({
    migrationId: v.optional(v.id("assistantImportMigrations")),
    requestId: v.optional(v.string()),
    inputHash: v.optional(v.string()),
    acquisitionFlowId: v.optional(v.id("importAcquisitionFlows")),
    selectedItemIds: v.optional(v.array(v.id("testimonialImportItems"))),
    result: v.optional(importResult),
    organizationId: v.id("organizations"),
    createdBy: v.string(),
    provider: importProvider,
    sourceUrl: v.string(),
    itemCount: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_migrationId", ["migrationId"])
    .index("by_organizationId_and_requestId", ["organizationId", "requestId"])
    .index("by_organizationId_and_provider_and_createdBy", [
      "organizationId",
      "provider",
      "createdBy",
    ])
    .index("by_expiresAt", ["expiresAt"]),
  testimonialImportItems: defineTable({
    avatarAttempt: v.optional(v.number()),
    avatarDiagnostic: v.optional(v.string()),
    avatarStatus: v.optional(
      v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    ),
    identityCorrection: v.optional(
      v.object({
        avatarStorageId: v.optional(v.union(v.null(), v.id("_storage"))),
        authorName: v.string(),
        tagline: v.string(),
        editedBy: v.string(),
        editedAt: v.number(),
      }),
    ),
    workflowId: v.optional(v.string()),
    videoAssetId: v.optional(v.id("videoAssets")),
    capacityBlocked: v.optional(v.boolean()),
    videoStatus: v.optional(
      v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    ),
    failureReason: v.optional(v.string()),
    sourceState: v.optional(
      v.union(
        v.literal("new"),
        v.literal("already_imported"),
        v.literal("changed"),
      ),
    ),
    outcome: v.optional(
      v.union(
        v.literal("imported"),
        v.literal("skipped"),
        v.literal("changed"),
        v.literal("unavailable"),
      ),
    ),
    testimonialId: v.optional(v.id("testimonials")),
    ...wallCandidate.fields,
    organizationId: v.id("organizations"),
    jobId: v.id("testimonialImportJobs"),
    position: v.number(),
  })
    .index("by_testimonialId", ["testimonialId"])
    .index("by_jobId_and_position", ["jobId", "position"])
    .index("by_jobId_type_position", ["jobId", "type", "position"])
    .index("by_organizationId", ["organizationId"]),
  accounts: defineTable({
    testimonialLinksEnabled: v.optional(v.boolean()),
    testimonialLinksRevision: v.optional(v.number()),
    publicationGeneration: v.optional(v.number()),
    publicationTransitionKey: v.optional(v.string()),
    preservedPublicationIds: v.optional(v.array(v.id("testimonials"))),
    lastProRecoveryAt: v.optional(v.number()),
    deletionStartedAt: v.optional(v.number()),
    selectedFreeProjectId: v.optional(v.id("organizations")),
    ownerUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerUserId"]),
  accountDeletions: defineTable({
    inventoryCursor: v.optional(v.string()),
    projectsInventoried: v.optional(v.boolean()),
    mediaProgress: v.optional(mediaDeletionProgress),
    accountId: v.id("accounts"),
    ownerUserId: v.string(),
    status: v.union(
      v.literal("requested"),
      v.literal("failed"),
      v.literal("deleted"),
    ),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_account", ["accountId"]),
  accountDeletionSubscriptions: defineTable({
    accountId: v.id("accounts"),
    stripeSubscriptionId: v.string(),
    canceledAt: v.optional(v.number()),
  })
    .index("by_subscription", ["stripeSubscriptionId"])
    .index("by_account_pending", ["accountId", "canceledAt"]),
  collectionAdmissions: defineTable({
    organizationId: v.id("organizations"),
    clientSubmissionId: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    imageUses: v.number(),
    avatarUses: v.number(),
    submissionUsed: v.boolean(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_organization", ["organizationId"]),
  organizations: defineTable({
    accountId: v.optional(v.id("accounts")),
    name: v.string(),
    slug: v.string(),
    publicSlug: v.string(),
    publicSlugChangedAt: v.optional(v.number()),
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.string(),
    collectionFormTitle: v.string(),
    collectionFormDescription: v.string(),
    privacyContact: v.string(),
    publicWallPrivacyRevision: v.optional(v.number()),
    publicWallTheme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    publicWallAccentColor: v.optional(v.string()),
    publicWallTransparentEmbed: v.optional(v.boolean()),
    publicWallHideAttribution: v.optional(v.boolean()),
    publicWallOrderVersion: v.optional(v.number()),
    publicWallTestimonialLinksEnabled: v.optional(v.boolean()),
    publicWallShowSourceIcons: v.optional(v.boolean()),
    publicWallVisibility: v.optional(
      v.object({
        avatar: v.boolean(),
        company: v.boolean(),
        rating: v.boolean(),
        role: v.boolean(),
      }),
    ),
    newSubmissionEmailNotificationsEnabled: v.optional(v.boolean()),
    createdByUserId: v.string(),
    deletionStartedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_account_open", ["accountId", "deletionStartedAt"])
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
    .index("by_organization", ["organizationId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_organization_status", ["organizationId", "status"]),
  billingProfiles: defineTable({
    accountId: v.optional(v.id("accounts")),
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
      v.union(
        v.literal("pro_monthly"),
        v.literal("pro_annual"),
        // Retained only so deployments with an abandoned starter Checkout
        // reservation can load and rotate it to the single Pro plan.
        v.literal("premium_monthly"),
        v.literal("premium_annual"),
      ),
    ),
    expectedProPriceId: v.optional(v.string()),
    stripeCheckoutSessionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_organization", ["organizationId"]),
  billingSubscriptionStates: defineTable({
    accountId: v.optional(v.id("accounts")),
    organizationId: v.id("organizations"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    priceId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    cancelAt: v.optional(v.number()),
    statusChangedAt: v.optional(v.number()),
    lastProviderGeneration: v.optional(v.number()),
    lastProviderObservedAt: v.optional(v.number()),
    lastStripeEventCreated: v.number(),
    lastStripeEventId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_account", ["accountId"])
    .index("by_account_status", ["accountId", "status"])
    .index("by_account_trusted_status_end", [
      "accountId",
      "stripeCustomerId",
      "priceId",
      "status",
      "cancelAtPeriodEnd",
      "currentPeriodEnd",
    ])
    .index("by_account_trusted_status_changed", [
      "accountId",
      "stripeCustomerId",
      "priceId",
      "status",
      "cancelAtPeriodEnd",
      "statusChangedAt",
    ]),
  stripeWebhookEvents: defineTable({
    stripeEventId: v.string(),
    stripeEventCreated: v.number(),
    eventType: v.string(),
    outcome: v.union(
      v.literal("applied"),
      v.literal("stale"),
      v.literal("ignored"),
      v.literal("queued"),
    ),
    stripeSubscriptionId: v.optional(v.string()),
    processedAt: v.number(),
  })
    .index("by_stripe_event", ["stripeEventId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),
  stripeSubscriptionReconciliations: defineTable({
    stripeSubscriptionId: v.string(),
    generation: v.number(),
    latestEventCreated: v.number(),
    latestEventId: v.string(),
    completedGeneration: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_stripe_subscription", ["stripeSubscriptionId"]),
  stripeInvoicePaymentFailures: defineTable({
    stripeInvoiceId: v.string(),
    stripeSubscriptionId: v.string(),
    firstFailedAt: v.number(),
    lastFailureEventCreated: v.number(),
    updatedAt: v.number(),
  })
    .index("by_stripe_invoice", ["stripeInvoiceId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),
  billingDowngradeTransitions: defineTable({
    accountId: v.optional(v.id("accounts")),
    activeProjectId: v.optional(v.id("organizations")),
    processingProjectId: v.optional(v.id("organizations")),
    processingAssets: v.optional(v.boolean()),
    projectCursor: v.optional(v.string()),
    projectsExhausted: v.optional(v.boolean()),
    organizationId: v.id("organizations"),
    stripeSubscriptionId: v.string(),
    version: v.number(),
    trigger: v.union(
      v.literal("scheduled_cancellation"),
      v.literal("payment_grace"),
      v.literal("terminal_status"),
    ),
    scheduledFor: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("processing"),
      v.literal("applied"),
      v.literal("recovered"),
    ),
    selectedTextIds: v.array(v.id("testimonials")),
    selectedVideoIds: v.array(v.id("testimonials")),
    resolvedTextIds: v.optional(v.array(v.id("testimonials"))),
    resolvedVideoIds: v.optional(v.array(v.id("testimonials"))),
    processingCursor: v.optional(v.string()),
    appliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),
  billingLifecycleEmails: defineTable({
    organizationId: v.id("organizations"),
    transitionId: v.id("billingDowngradeTransitions"),
    transitionVersion: v.number(),
    deliveryKey: v.string(),
    kind: v.union(
      v.literal("downgrade_d7"),
      v.literal("downgrade_d1"),
      v.literal("video_retention_started"),
      v.literal("video_retention_d7"),
      v.literal("video_retention_d1"),
    ),
    recipientEmail: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    provider: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
    scheduledFor: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_delivery_key", ["deliveryKey"])
    .index("by_transition", ["transitionId"])
    .index("by_organization", ["organizationId"]),
  videoDowngradeRetentions: defineTable({
    organizationId: v.id("organizations"),
    transitionId: v.id("billingDowngradeTransitions"),
    testimonialId: v.optional(v.id("testimonials")),
    videoAssetId: v.id("videoAssets"),
    retainedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("retained"),
      v.literal("deleting"),
      v.literal("deleted"),
    ),
    attempts: v.number(),
    deletionLeaseId: v.optional(v.string()),
    deletionLeaseExpiresAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_video_asset", ["videoAssetId"])
    .index("by_organization", ["organizationId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_transition_status_expiry", [
      "transitionId",
      "status",
      "expiresAt",
    ])
    .index("by_transition", ["transitionId"])
    .index("by_expiry", ["status", "expiresAt"]),
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
    .index("by_organization", ["organizationId"])
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
      v.literal("testimonial.revised"),
      v.literal("testimonial.spam_marked"),
      v.literal("testimonial.spam_undone"),
      v.literal("testimonial.spam_credit_restored"),
      v.literal("testimonial.spam_expired"),
      v.literal("testimonial.consent_withdrawn"),
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
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_occurred_at", ["organizationId", "occurredAt"])
    .index("by_organization_target", [
      "organizationId",
      "targetType",
      "targetId",
    ]),
  testimonialImages: defineTable({
    organizationId: v.id("organizations"),
    clientSubmissionId: v.string(),
    managementTestimonialId: v.optional(v.id("testimonials")),
    testimonialId: v.optional(v.id("testimonials")),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_storage_id", ["storageId"])
    .index("by_management_testimonial", ["managementTestimonialId"])
    .index("by_storage_organization", ["storageId", "organizationId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"]),
  testimonials: defineTable({
    importJobId: v.optional(v.id("testimonialImportJobs")),
    importSourceKey: v.optional(v.string()),
    importOrigin: v.optional(importOrigin),
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
    richText: v.optional(richTextValidator),
    imageIds: v.optional(v.array(v.id("testimonialImages"))),
    // The video thumbnail the Owner chose: a frame of the video, or an image
    // they uploaded. Both absent means the middle of the video.
    posterTimeSeconds: v.optional(v.number()),
    posterStorageId: v.optional(v.id("_storage")),
    submitterName: v.string(),
    submitterEmail: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    role: v.optional(v.string()),
    company: v.optional(v.string()),
    rating: v.optional(v.number()),
    managementTokenHash: v.optional(v.string()),
    managementTokenExpiresAt: v.optional(v.number()),
    contentVersion: v.optional(v.number()),
    publicVisibilityOverrides: v.optional(
      v.object({
        avatar: v.optional(v.boolean()),
        company: v.optional(v.boolean()),
        rating: v.optional(v.boolean()),
        role: v.optional(v.boolean()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_submission_type", [
      "organizationId",
      "submissionType",
    ])
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_organizationId_and_importSourceKey", [
      "organizationId",
      "importSourceKey",
    ])
    .index("by_organization_import_status", [
      "organizationId",
      "importJobId",
      "moderationStatus",
    ])
    .index("by_organization_import", ["organizationId", "importJobId"])
    .index("by_organization_status", ["organizationId", "moderationStatus"])
    .index("by_organization_created_at", ["organizationId", "createdAt"])
    .index("by_organization_submitter_email", [
      "organizationId",
      "submitterEmail",
    ])
    .index("by_management_token_hash", ["managementTokenHash"])
    .index("by_avatar_storage_id", ["avatarStorageId"])
    .index("by_poster_storage_id", ["posterStorageId"])
    .index("by_avatar_storage_organization", [
      "avatarStorageId",
      "organizationId",
    ])
    .index("by_poster_storage_organization", [
      "posterStorageId",
      "organizationId",
    ]),
  collectionCredits: defineTable({
    accountId: v.optional(v.id("accounts")),
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    submissionType: v.union(v.literal("text"), v.literal("video")),
    consumedAt: v.number(),
    restoredAt: v.optional(v.number()),
    restorationMode: v.optional(
      v.union(v.literal("automatic"), v.literal("support")),
    ),
  })
    .index("by_account", ["accountId"])
    .index("by_account_type_restored", [
      "accountId",
      "submissionType",
      "restoredAt",
    ])
    .index("by_organization", ["organizationId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization_type", ["organizationId", "submissionType"]),
  accountSpamRestorations: defineTable({
    accountId: v.id("accounts"),
    reportedAt: v.number(),
  }).index("by_account_reported_at", ["accountId", "reportedAt"]),
  spamQuarantines: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    previousModerationStatus: v.union(
      v.literal("pending"),
      v.literal("published"),
      v.literal("archived"),
    ),
    previousPublishedAt: v.optional(v.number()),
    previousPublicOrderKey: v.optional(v.string()),
    reportedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("undone"),
      v.literal("expired"),
    ),
    creditRestored: v.boolean(),
    restorationMode: v.optional(
      v.union(v.literal("automatic"), v.literal("support")),
    ),
    supportActor: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization_reported_at", ["organizationId", "reportedAt"])
    .index("by_status_expiry", ["status", "expiresAt"]),
  publicTestimonialProjections: defineTable(
    v.union(
      v.object({
        importJobId: v.optional(v.id("testimonialImportJobs")),
        source: v.optional(testimonialSourceValidator),
        publicationGeneration: v.optional(v.number()),
        organizationId: v.id("organizations"),
        testimonialId: v.id("testimonials"),
        type: v.literal("text"),
        text: v.string(),
        richText: v.optional(richTextValidator),
        imageIds: v.optional(v.array(v.id("testimonialImages"))),
        name: v.string(),
        avatarStorageId: v.optional(v.id("_storage")),
        role: v.optional(v.string()),
        company: v.optional(v.string()),
        rating: v.optional(v.number()),
        publishedAt: v.number(),
        // Optional during the two-phase public-order migration. Remove the
        // wrapper only after migrations:backfillPublicOrderKeys is complete on
        // every deployment.
        publicOrderKey: v.optional(v.string()),
        visibilityOverrides: v.optional(
          v.object({
            avatar: v.optional(v.boolean()),
            company: v.optional(v.boolean()),
            rating: v.optional(v.boolean()),
            role: v.optional(v.boolean()),
          }),
        ),
      }),
      v.object({
        importJobId: v.optional(v.id("testimonialImportJobs")),
        source: v.optional(testimonialSourceValidator),
        publicationGeneration: v.optional(v.number()),
        organizationId: v.id("organizations"),
        testimonialId: v.id("testimonials"),
        type: v.literal("video"),
        playbackId: v.string(),
        aspectRatio: v.optional(v.string()),
        captionsAvailable: v.boolean(),
        posterTimeSeconds: v.optional(v.number()),
        posterStorageId: v.optional(v.id("_storage")),
        name: v.string(),
        avatarStorageId: v.optional(v.id("_storage")),
        role: v.optional(v.string()),
        company: v.optional(v.string()),
        rating: v.optional(v.number()),
        publishedAt: v.number(),
        // Optional during the two-phase public-order migration. Remove the
        // wrapper only after migrations:backfillPublicOrderKeys is complete on
        // every deployment.
        publicOrderKey: v.optional(v.string()),
        visibilityOverrides: v.optional(
          v.object({
            avatar: v.optional(v.boolean()),
            company: v.optional(v.boolean()),
            rating: v.optional(v.boolean()),
            role: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
  )
    .index("by_organization", ["organizationId"])
    .index("by_organization_published_at", ["organizationId", "publishedAt"])
    .index("by_organization_type_published_at", [
      "organizationId",
      "type",
      "publishedAt",
    ])
    .index("by_organization_type_generation", [
      "organizationId",
      "type",
      "publicationGeneration",
    ])
    .index("by_organization_import_order", [
      "organizationId",
      "importJobId",
      "publicOrderKey",
    ])
    .index("by_organization_order_key", ["organizationId", "publicOrderKey"])
    .index("by_testimonial", ["testimonialId"]),
  publicReadRateLimitBuckets: defineTable({
    resourceKey: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
    expiresAt: v.number(),
  })
    .index("by_resource_window", ["resourceKey", "windowStartedAt"])
    .index("by_expires_at", ["expiresAt"]),
  managementLinkReplacementRequests: defineTable({
    organizationId: v.optional(v.id("organizations")),
    requestKey: v.string(),
    recipientEmail: v.optional(v.string()),
    brandName: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request_key", ["requestKey"])
    .index("by_organization", ["organizationId"]),
  managementLinkReplacementItems: defineTable({
    organizationId: v.id("organizations"),
    requestId: v.id("managementLinkReplacementRequests"),
    testimonialId: v.id("testimonials"),
    tokenHash: v.string(),
    tokenSeed: v.string(),
    createdAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"]),
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
    .index("by_organization", ["organizationId"])
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_storage_id", ["storageId"])
    .index("by_expiry", ["expiresAt"]),
  videoReservations: defineTable({
    importItemId: v.optional(v.id("testimonialImportItems")),
    freeCreditPending: v.optional(v.boolean()),
    accountId: v.optional(v.id("accounts")),
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
    .index("by_account_pending_credit", ["accountId", "freeCreditPending"])
    .index("by_account_status", ["accountId", "status"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_client_submission", [
      "organizationId",
      "clientSubmissionId",
    ])
    .index("by_organization_status", ["organizationId", "status"])
    .index("by_provider_upload_id", ["providerUploadId"])
    .index("by_expiry", ["expiresAt"]),
  videoAssets: defineTable({
    assistantImport: v.optional(v.boolean()),
    importedFileVerified: v.optional(v.boolean()),
    importCopyStartedAt: v.optional(v.number()),
    importCopyCleanupResolvedAt: v.optional(v.number()),
    importItemId: v.optional(v.id("testimonialImportItems")),
    accountId: v.optional(v.id("accounts")),
    organizationId: v.id("organizations"),
    reservationId: v.id("videoReservations"),
    testimonialId: v.optional(v.id("testimonials")),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerUploadId: v.optional(v.string()),
    cleanupScheduled: v.optional(v.boolean()),
    providerAssetId: v.optional(v.string()),
    playbackId: v.optional(v.string()),
    // Cleanup-only compatibility for derived assets created before MP4 export
    // was removed. No active function writes these fields.
    downloadProviderAssetId: v.optional(v.string()),
    downloadPlaybackId: v.optional(v.string()),
    spokenLanguage: v.optional(v.union(v.literal("en"), v.literal("fr"))),
    mimeType: v.string(),
    fileSizeBytes: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    aspectRatio: v.optional(v.string()),
    sourceHeight: v.optional(v.number()),
    sourceWidth: v.optional(v.number()),
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
    .index("by_account_status", ["accountId", "status"])
    .index("by_organization", ["organizationId"])
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
    .index("by_video_asset", ["videoAssetId"])
    .index("by_organization", ["organizationId"]),
  submissionVideoRevisions: defineTable({
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    baseContentVersion: v.number(),
    reservationId: v.id("videoReservations"),
    videoAssetId: v.optional(v.id("videoAssets")),
    status: v.union(
      v.literal("active"),
      v.literal("confirmed"),
      v.literal("superseded"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_testimonial_status", ["testimonialId", "status"])
    .index("by_reservation", ["reservationId"])
    .index("by_organization", ["organizationId"]),
  videoMediaDeletions: defineTable({
    inventoryStage: v.optional(v.number()),
    inventoryCursor: v.optional(v.string()),
    mediaProgress: v.optional(mediaDeletionProgress),
    organizationId: v.id("organizations"),
    testimonialId: v.id("testimonials"),
    providerAssets: v.array(
      v.object({
        provider: v.union(v.literal("fake"), v.literal("mux")),
        providerAssetId: v.string(),
      }),
    ),
    providerUploads: v.optional(
      v.array(
        v.object({
          provider: v.union(v.literal("fake"), v.literal("mux")),
          providerUploadId: v.string(),
        }),
      ),
    ),
    status: v.union(
      v.literal("requested"),
      v.literal("failed"),
      v.literal("deleted"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"]),
  // No source URL, author or testimonial content: only late-copy correlation.
  videoImportCleanupIntents: defineTable({
    accountId: v.optional(v.id("accounts")),
    organizationId: v.id("organizations"),
    assetId: v.id("videoAssets"),
    reservationId: v.id("videoReservations"),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    createdAt: v.number(),
    nextAttemptAt: v.optional(v.number()),
    probe: v.optional(v.number()),
    cursor: v.optional(v.string()),
    completedScans: v.optional(v.number()),
    failures: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    lastScanCompletedAt: v.optional(v.number()),
    reviewRequiredAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_nextAttemptAt", ["nextAttemptAt"])
    .index("by_asset", ["assetId"])
    .index("by_reservation", ["reservationId"])
    .index("by_account", ["accountId"])
    .index("by_organization", ["organizationId"]),
  videoProviderCleanupJobs: defineTable({
    accountId: v.optional(v.id("accounts")),
    attempts: v.number(),
    organizationId: v.id("organizations"),
    testimonialId: v.optional(v.id("testimonials")),
    provider: v.union(v.literal("fake"), v.literal("mux")),
    providerAssetId: v.optional(v.string()),
    providerUploadId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_testimonial", ["testimonialId"])
    .index("by_organization", ["organizationId"])
    .index("by_provider_asset", ["provider", "providerAssetId"])
    .index("by_provider_upload", ["provider", "providerUploadId"]),
  storageCleanupJobs: defineTable({
    attemptId: v.string(),
    key: v.literal("submission-avatar-orphans"),
    leaseExpiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  workspaceDeletions: defineTable({
    accountDeletionId: v.optional(v.id("accountDeletions")),
    inventoryStage: v.optional(v.number()),
    inventoryCursor: v.optional(v.string()),
    mediaInventoryComplete: v.optional(v.boolean()),
    mediaProgress: v.optional(mediaDeletionProgress),
    accountId: v.optional(v.id("accounts")),
    organizationId: v.id("organizations"),
    actorUserId: v.string(),
    status: v.union(
      v.literal("requested"),
      v.literal("failed"),
      v.literal("deleted"),
    ),
    phase: v.string(),
    subscriptionIds: v.optional(v.array(v.string())),
    leaseId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_actor", ["actorUserId"])
    .index("by_account_inventory", [
      "accountDeletionId",
      "mediaInventoryComplete",
    ]),
  deletionMediaTargets: defineTable({
    deletionId: v.union(
      v.id("workspaceDeletions"),
      v.id("videoMediaDeletions"),
      v.id("accountDeletions"),
    ),
    provider: v.union(
      v.literal("storage"),
      v.literal("mux"),
      v.literal("fake"),
    ),
    kind: v.union(v.literal("image"), v.literal("video"), v.literal("upload")),
    resourceId: v.string(),
    sharingStage: v.optional(v.number()),
    sharingCursor: v.optional(v.string()),
    retained: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_deletion_resource", [
      "deletionId",
      "provider",
      "kind",
      "resourceId",
    ])
    .index("by_deletion_pending", ["deletionId", "deletedAt"]),
  workspaceDeletionSubscriptions: defineTable({
    deletionId: v.id("workspaceDeletions"),
    stripeSubscriptionId: v.string(),
    createdAt: v.number(),
    canceledAt: v.optional(v.number()),
  })
    .index("by_deletion", ["deletionId"])
    .index("by_deletion_canceled_at", ["deletionId", "canceledAt"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),
});
