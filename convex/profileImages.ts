import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { validateExclusiveStoredImage } from "./domain/profileImage";
import { requireVerifiedPrincipal } from "./security/principal";

export const generateAvatarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireVerifiedPrincipal(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setMyAvatar = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const principal = await requireVerifiedPrincipal(ctx);
    await validateExclusiveStoredImage(ctx, args.storageId, {
      kind: "user",
      userId: principal.actorId,
    });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (index) => index.eq("userId", principal.actorId))
      .unique();
    const previousStorageId = profile?.avatarStorageId;
    const updatedAt = Date.now();
    if (profile) {
      await ctx.db.patch(profile._id, {
        avatarStorageId: args.storageId,
        updatedAt,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: principal.actorId,
        avatarStorageId: args.storageId,
        updatedAt,
      });
    }
    if (previousStorageId && previousStorageId !== args.storageId) {
      await ctx.storage.delete(previousStorageId);
    }
    return null;
  },
});

export const removeMyAvatar = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const principal = await requireVerifiedPrincipal(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (index) => index.eq("userId", principal.actorId))
      .unique();
    if (!profile?.avatarStorageId) return null;
    const previousStorageId = profile.avatarStorageId;
    await ctx.db.patch(profile._id, {
      avatarStorageId: undefined,
      updatedAt: Date.now(),
    });
    await ctx.storage.delete(previousStorageId);
    return null;
  },
});
