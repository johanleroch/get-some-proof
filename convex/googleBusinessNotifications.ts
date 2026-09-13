import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOrganizationPermission } from "./security/organizationAccess";

const target = { organizationId: v.id("organizations") };

export const begin = internalMutation({
  args: { ...target, generation: v.string(), operation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      args,
      "ownership:manage",
    );
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (
      !row ||
      row.generation !== args.generation ||
      row.disconnectingUntil ||
      !row.encryptedRefreshToken ||
      row.ownerId !== access.principal.actorId
    )
      throw new ConvexError({
        code: "GOOGLE_CONNECTION_CHANGED",
        message: "The Google connection changed. Connect again.",
      });
    await ctx.db.patch(row._id, { notificationOperation: args.operation });
    return null;
  },
});

export const save = internalMutation({
  args: {
    ...target,
    operation: v.string(),
    generation: v.string(),
    account: v.string(),
    location: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      args,
      "ownership:manage",
    );
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (
      !row ||
      row.notificationOperation !== args.operation ||
      row.generation !== args.generation ||
      row.disconnectingUntil ||
      !row.encryptedRefreshToken ||
      row.ownerId !== access.principal.actorId
    ) {
      throw new ConvexError({
        code: "GOOGLE_CONNECTION_CHANGED",
        message:
          "The Google connection changed. Connect again before enabling updates.",
      });
    }
    await ctx.db.patch(row._id, {
      notificationOperation: undefined,
      notificationAccount: args.account,
      notificationLocation: args.location,
      notificationEnabledAt: Date.now(),
      notificationRevision: 0,
      notificationLastEventAt: undefined,
    });
    return null;
  },
});

// Google configures notifications for the whole account. Disable only this
// Project's delivery; clearing the shared topic would interrupt other Projects.
export const disable = mutation({
  args: target,
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(ctx, args, "ownership:manage");
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (row)
      await ctx.db.patch(row._id, {
        notificationOperation: undefined,
        notificationAccount: undefined,
        notificationLocation: undefined,
        notificationRevision: undefined,
        notificationLastEventAt: undefined,
        notificationEnabledAt: undefined,
      });
    return null;
  },
});

export const receive = internalMutation({
  args: {
    messageId: v.string(),
    account: v.string(),
    location: v.string(),
    publishedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleBusinessNotificationEvents")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .unique();
    if (existing) return null;
    const listeners = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_notification_location", (q) =>
        q
          .eq("notificationAccount", args.account)
          .eq("notificationLocation", args.location),
      )
      .take(1);
    if (!listeners.length) return null;
    // Retain only routing/deduplication metadata, never the review content.
    const retentionMs = 7 * 24 * 60 * 60_000;
    const eventId = await ctx.db.insert("googleBusinessNotificationEvents", {
      ...args,
      expiresAt: Date.now() + retentionMs,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.googleBusinessNotifications.deliver,
      { eventId, cursor: null },
    );
    await ctx.scheduler.runAfter(
      retentionMs,
      internal.googleBusinessNotifications.expire,
      { eventId },
    );
    return null;
  },
});

export const deliver = internalMutation({
  args: {
    eventId: v.id("googleBusinessNotificationEvents"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.expiresAt <= Date.now()) return null;
    const rows = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_notification_location", (q) =>
        q
          .eq("notificationAccount", event.account)
          .eq("notificationLocation", event.location),
      )
      .paginate({ cursor: args.cursor, numItems: 100 });
    for (const row of rows.page) {
      if (
        !row.encryptedRefreshToken ||
        row.disconnectingUntil ||
        event.publishedAt < (row.notificationEnabledAt ?? Infinity)
      )
        continue;
      await ctx.db.patch(row._id, {
        notificationRevision: (row.notificationRevision ?? 0) + 1,
        notificationLastEventAt: Math.max(
          row.notificationLastEventAt ?? 0,
          event.publishedAt,
        ),
      });
    }
    if (!rows.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.googleBusinessNotifications.deliver,
        { eventId: args.eventId, cursor: rows.continueCursor },
      );
    return null;
  },
});

export const expire = internalMutation({
  args: { eventId: v.id("googleBusinessNotificationEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (event && event.expiresAt <= Date.now()) await ctx.db.delete(event._id);
    return null;
  },
});
