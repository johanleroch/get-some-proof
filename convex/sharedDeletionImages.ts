import type { Doc, Id } from "./_generated/dataModel";
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

/** One bounded page per mutation; a popular image never restarts a full scan. */
export async function advanceAccountImageSharingCheck(
  ctx: MutationCtx,
  target: Doc<"deletionMediaTargets">,
  account: { accountId: Id<"accounts">; ownerUserId: string },
): Promise<"pending" | "shared" | "exclusive"> {
  const storageId = target.resourceId as Id<"_storage">;
  const stage = target.sharingStage ?? 0;
  if (stage >= 5) return "exclusive";
  const opts = { cursor: target.sharingCursor ?? null, numItems: 16 };
  const page =
    stage === 0
      ? await ctx.db
          .query("organizations")
          .withIndex("by_logo_storage_id", (q) =>
            q.eq("logoStorageId", storageId),
          )
          .paginate(opts)
      : stage === 1
        ? await ctx.db
            .query("userProfiles")
            .withIndex("by_avatar_storage_id", (q) =>
              q.eq("avatarStorageId", storageId),
            )
            .paginate(opts)
        : stage === 2
          ? await ctx.db
              .query("testimonials")
              .withIndex("by_avatar_storage_id", (q) =>
                q.eq("avatarStorageId", storageId),
              )
              .paginate(opts)
          : stage === 3
            ? await ctx.db
                .query("testimonials")
                .withIndex("by_poster_storage_id", (q) =>
                  q.eq("posterStorageId", storageId),
                )
                .paginate(opts)
            : await ctx.db
                .query("testimonialImages")
                .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
                .paginate(opts);
  for (const record of page.page) {
    if ("organizationId" in record) {
      if (
        (await ctx.db.get(record.organizationId))?.accountId !==
        account.accountId
      )
        return "shared";
    } else if ("userId" in record) {
      if (record.userId !== account.ownerUserId) return "shared";
    } else if (record.accountId !== account.accountId) return "shared";
  }
  await ctx.db.patch(target._id, {
    sharingStage: page.isDone ? stage + 1 : stage,
    sharingCursor: page.isDone ? undefined : page.continueCursor,
  });
  return page.isDone && stage === 4 ? "exclusive" : "pending";
}
