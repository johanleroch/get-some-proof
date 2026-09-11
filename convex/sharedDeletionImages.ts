import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** An image still used outside the deletion scope belongs to the remaining entity. */
export async function imageUsedElsewhere(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  scope: {
    organizationId?: Id<"organizations">;
    testimonialId?: Id<"testimonials">;
    ownerUserId?: string;
    accountId?: Id<"accounts">;
  },
) {
  if (scope.accountId && scope.ownerUserId) {
    for await (const org of ctx.db
      .query("organizations")
      .withIndex("by_logo_storage_id", (q) => q.eq("logoStorageId", storageId)))
      if (org.accountId !== scope.accountId) return true;
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_avatar_storage_id", (q) =>
        q.eq("avatarStorageId", storageId),
      )
      .take(2);
    if (profiles.some((profile) => profile.userId !== scope.ownerUserId))
      return true;
    const queries = [
      ctx.db
        .query("testimonials")
        .withIndex("by_avatar_storage_id", (q) =>
          q.eq("avatarStorageId", storageId),
        ),
      ctx.db
        .query("testimonials")
        .withIndex("by_poster_storage_id", (q) =>
          q.eq("posterStorageId", storageId),
        ),
      ctx.db
        .query("testimonialImages")
        .withIndex("by_storage_id", (q) => q.eq("storageId", storageId)),
    ];
    for (const query of queries)
      for await (const record of query) {
        const org = await ctx.db.get(record.organizationId);
        if (org?.accountId !== scope.accountId) return true;
      }
    return false;
  }
  const organizations = await ctx.db
    .query("organizations")
    .withIndex("by_logo_storage_id", (q) => q.eq("logoStorageId", storageId))
    .take(2);
  if (
    organizations.some(
      (org) => scope.testimonialId || org._id !== scope.organizationId,
    )
  )
    return true;
  const profiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_avatar_storage_id", (q) =>
      q.eq("avatarStorageId", storageId),
    )
    .take(2);
  if (profiles.some((profile) => profile.userId !== scope.ownerUserId))
    return true;
  if (scope.testimonialId) {
    const [avatars, posters, images] = await Promise.all([
      ctx.db
        .query("testimonials")
        .withIndex("by_avatar_storage_id", (q) =>
          q.eq("avatarStorageId", storageId),
        )
        .take(2),
      ctx.db
        .query("testimonials")
        .withIndex("by_poster_storage_id", (q) =>
          q.eq("posterStorageId", storageId),
        )
        .take(2),
      ctx.db
        .query("testimonialImages")
        .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
        .take(5),
    ]);
    return (
      [...avatars, ...posters].some((row) => row._id !== scope.testimonialId) ||
      images.some(
        (row) =>
          row.testimonialId !== scope.testimonialId &&
          row.managementTestimonialId !== scope.testimonialId,
      )
    );
  }
  if (scope.organizationId) {
    const id = scope.organizationId;
    const [
      avatarBefore,
      avatarAfter,
      posterBefore,
      posterAfter,
      imageBefore,
      imageAfter,
    ] = await Promise.all([
      ctx.db
        .query("testimonials")
        .withIndex("by_avatar_storage_organization", (q) =>
          q.eq("avatarStorageId", storageId).lt("organizationId", id),
        )
        .first(),
      ctx.db
        .query("testimonials")
        .withIndex("by_avatar_storage_organization", (q) =>
          q.eq("avatarStorageId", storageId).gt("organizationId", id),
        )
        .first(),
      ctx.db
        .query("testimonials")
        .withIndex("by_poster_storage_organization", (q) =>
          q.eq("posterStorageId", storageId).lt("organizationId", id),
        )
        .first(),
      ctx.db
        .query("testimonials")
        .withIndex("by_poster_storage_organization", (q) =>
          q.eq("posterStorageId", storageId).gt("organizationId", id),
        )
        .first(),
      ctx.db
        .query("testimonialImages")
        .withIndex("by_storage_organization", (q) =>
          q.eq("storageId", storageId).lt("organizationId", id),
        )
        .first(),
      ctx.db
        .query("testimonialImages")
        .withIndex("by_storage_organization", (q) =>
          q.eq("storageId", storageId).gt("organizationId", id),
        )
        .first(),
    ]);
    return !!(
      avatarBefore ||
      avatarAfter ||
      posterBefore ||
      posterAfter ||
      imageBefore ||
      imageAfter
    );
  }
  return false;
}
