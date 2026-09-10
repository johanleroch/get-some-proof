import { z } from "zod";
export const importEligibilitySchema = z.object({
  selected: z.number().int().nonnegative(),
  text: z.number().int().nonnegative(),
  video: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
  videoCapacityExceeded: z.number().int().nonnegative(),
  eligibleKeys: z.array(z.string()).max(100),
});
export const snapshotSchema = {
  provider: z.enum(["senja", "testimonial-to"]),
  sourceUrl: z.string(),
  itemCount: z.number(),
  expiresAt: z.number(),
  selectedPositions: z.array(z.number()),
  items: z.array(
    z.object({
      position: z.number(),
      sourceId: z.string(),
      type: z.enum(["text", "video"]),
      authorName: z.string(),
      text: z.string(),
      tagline: z.string().optional(),
      avatarUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      unavailableReason: z.literal("VIDEO_SOURCE_UNAVAILABLE").optional(),
    }),
  ),
  nextOffset: z.number().nullable(),
};

export const previewSchema = z.object(snapshotSchema);

export const importProjectsSchema = z.object({
  page: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        videoCapacity: z
          .object({
            used: z.number().int().nonnegative(),
            limit: z.number().int().nonnegative(),
            available: z.boolean(),
            configured: z.boolean(),
          })
          .optional(),
      }),
    )
    .max(20),
  isDone: z.boolean(),
  continueCursor: z.string(),
});
export const savedImportSchema = z.object({
  outcomes: z
    .array(
      z.object({
        sourceId: z.string(),
        itemId: z.string(),
        status: z.enum([
          "created",
          "duplicate",
          "conflict",
          "processing",
          "failed",
          "blocked",
        ]),
      }),
    )
    .max(50)
    .optional(),
  jobId: z.string(),
  organizationSlug: z.string(),
  inboxUrl: z.url(),
  result: z.object({
    blocked: z.number().int().nonnegative().optional(),
    imported: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
  }),
});

export const importStatusSchema = savedImportSchema.extend({
  availableVideoSlots: z.number().int().nonnegative().optional(),
  photos: z
    .array(
      z.object({
        itemId: z.string(),
        authorName: z.string(),
        status: z.enum(["processing", "ready", "failed"]),
      }),
    )
    .max(500)
    .optional(),
  videos: z
    .array(
      z.object({
        itemId: z.string(),
        authorName: z.string(),
        failureMessage: z.string().optional(),
        blocked: z.boolean().optional(),
        status: z.enum(["processing", "ready", "failed"]),
      }),
    )
    .max(500),
});

export const importOperationErrorSchema = z.enum([
  "VIDEO_CAPACITY_REACHED",
  "INVALID_RETRY",
  "IMPORT_UNAVAILABLE",
]);
export const importOperationErrorMessages = {
  VIDEO_CAPACITY_REACHED:
    "Video storage is unavailable. Free a video storage place or wait for cleanup before retrying.",
  INVALID_RETRY:
    "This video can no longer be retried. Refresh progress to see its current state.",
  IMPORT_UNAVAILABLE:
    "This import is no longer available. Open the Inbox to review your testimonials.",
};

export const assistantMigrationStatusSchema = z.object({
  migrationId: z.string(),
  discoveredCount: z.number(),
  processedCount: z.number(),
  remainingCount: z.number(),
  batchCount: z.number(),
  result: savedImportSchema.shape.result,
  page: z
    .array(
      z.object({
        jobId: z.string(),
        result: savedImportSchema.shape.result.optional(),
      }),
    )
    .max(20),
  isDone: z.boolean(),
  continueCursor: z.string(),
});

export const assistantUploadCapabilitySchema = z.object({
  status: z.enum(["uploading", "finalizing", "complete"]),
  uploadUrl: z.url(),
  uploadToken: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number(),
  offset: z.number().int().nonnegative(),
  totalBytes: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
});
