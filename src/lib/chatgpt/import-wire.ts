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
  jobId: z.string(),
  organizationSlug: z.string(),
  inboxUrl: z.string().url(),
  result: z.object({
    imported: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
  }),
});

export const importStatusSchema = savedImportSchema.extend({
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
