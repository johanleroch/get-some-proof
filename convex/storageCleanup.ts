import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { randomSubmissionManagementToken } from "./domain/submission";
const orphanedStorageMinimumAgeMs = 2 * 60 * 60 * 1_000;
const storageCleanupLeaseMs = 60 * 60 * 1_000;

export async function scheduleOrphanedStorageCleanup(ctx: MutationCtx) {
  const now = Date.now();
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
    internal.storageCleanup.cleanupUnreferencedAvatarStorage,
    { attemptId: cleanupAttemptId, cleanupJobId },
  );
}

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
      const [
        profile,
        organization,
        testimonial,
        poster,
        uploadReservation,
        attachment,
      ] = await Promise.all([
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
          .query("testimonials")
          .withIndex("by_poster_storage_id", (index) =>
            index.eq("posterStorageId", storedFile._id),
          )
          .first(),
        ctx.db
          .query("submissionAvatarUploads")
          .withIndex("by_storage_id", (index) =>
            index.eq("storageId", storedFile._id),
          )
          .first(),
        ctx.db
          .query("testimonialImages")
          .withIndex("by_storage_id", (q) => q.eq("storageId", storedFile._id))
          .first(),
      ]);
      if (
        !profile &&
        !organization &&
        !testimonial &&
        !poster &&
        !uploadReservation &&
        !attachment
      ) {
        await ctx.storage.delete(storedFile._id);
      }
    }
    if (!storedFiles.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.storageCleanup.cleanupUnreferencedAvatarStorage,
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
