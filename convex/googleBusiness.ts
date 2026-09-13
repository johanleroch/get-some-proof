import { ConvexError, v } from "convex/values";
import {
  env,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireOrganizationPermission } from "./security/organizationAccess";
import schema from "./schema";
import { internal } from "./_generated/api";

const target = { organizationId: v.id("organizations") };
function stale(): never {
  throw new ConvexError({
    code: "GOOGLE_CONNECTION_CHANGED",
    message: "This Google connection expired or changed. Connect again.",
  });
}

export const status = query({
  args: target,
  returns: v.object({
    connected: v.boolean(),
    disconnecting: v.boolean(),
    configured: v.boolean(),
    notificationsConfigured: v.boolean(),
    notifications: v.union(
      v.null(),
      v.object({
        account: v.string(),
        location: v.string(),
        revision: v.number(),
        lastEventAt: v.union(v.number(), v.null()),
      }),
    ),
    generation: v.union(v.string(), v.null()),
  }),
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
    return {
      notificationsConfigured: !!(
        env.GOOGLE_BUSINESS_PUBSUB_TOPIC &&
        env.GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION &&
        env.GOOGLE_BUSINESS_PUBSUB_AUDIENCE &&
        env.GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL
      ),
      notifications:
        row?.notificationAccount &&
        row.notificationLocation &&
        row.encryptedRefreshToken &&
        row.ownerId === access.principal.actorId &&
        !row.disconnectingUntil
          ? {
              account: row.notificationAccount,
              location: row.notificationLocation,
              revision: row.notificationRevision ?? 0,
              lastEventAt: row.notificationLastEventAt ?? null,
            }
          : null,
      disconnecting: row?.disconnectingUntil !== undefined,
      connected:
        !!row?.encryptedRefreshToken &&
        row.ownerId === access.principal.actorId,
      configured: !!(
        env.GOOGLE_BUSINESS_CLIENT_ID &&
        env.GOOGLE_BUSINESS_CLIENT_SECRET &&
        env.GOOGLE_BUSINESS_ENCRYPTION_KEY &&
        env.GOOGLE_BUSINESS_REDIRECT_URI
      ),
      generation: row?.generation ?? null,
    };
  },
});

export const begin = internalMutation({
  args: {
    ...target,
    stateHash: v.string(),
    verifier: v.string(),
    generation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { principal } = await requireOrganizationPermission(
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
    if (row && (row.disconnectingUntil ?? 0) > Date.now())
      throw new ConvexError({
        code: "GOOGLE_DISCONNECTING",
        message: "Google is disconnecting. Try again in a moment.",
      });
    if (row && Date.now() - row.updatedAt < 3000)
      throw new ConvexError({
        code: "GOOGLE_BUSY",
        message: "Wait a moment before connecting again.",
      });
    const fields = {
      ...args,
      disconnectingUntil: undefined,
      encryptedRefreshToken:
        row?.ownerId === principal.actorId
          ? row.encryptedRefreshToken
          : undefined,
      notificationOperation: undefined,
      notificationAccount: undefined,
      notificationLocation: undefined,
      notificationRevision: undefined,
      notificationLastEventAt: undefined,
      notificationEnabledAt: undefined,
      ownerId: principal.actorId,
      expiresAt: Date.now() + 10 * 60_000,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("googleBusinessConnections", fields);
    return null;
  },
});

export const consume = internalMutation({
  args: { stateHash: v.string() },
  returns: v.object({
    organizationId: v.id("organizations"),
    generation: v.string(),
    verifier: v.string(),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!row || !row.verifier || !row.expiresAt || row.expiresAt <= Date.now())
      stale();
    const access = await requireOrganizationPermission(
      ctx,
      row,
      "ownership:manage",
    );
    if (access.principal.actorId !== row.ownerId) stale();
    await ctx.db.patch(row._id, {
      stateHash: undefined,
      verifier: undefined,
      expiresAt: undefined,
    });
    return {
      organizationId: row.organizationId,
      generation: row.generation,
      verifier: row.verifier,
      slug: access.organization.slug,
    };
  },
});

export const credentials = internalQuery({
  args: target,
  returns: schema.doc("googleBusinessConnections"),
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
      row.disconnectingUntil ||
      access.principal.actorId !== row.ownerId
    )
      stale();
    return row;
  },
});

export const save = internalMutation({
  args: {
    ...target,
    generation: v.string(),
    encryptedRefreshToken: v.string(),
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
      row.generation !== args.generation ||
      row.disconnectingUntil !== undefined ||
      row.ownerId !== access.principal.actorId
    )
      stale();
    await ctx.db.patch(row._id, {
      encryptedRefreshToken: args.encryptedRefreshToken,
      notificationOperation: undefined,
      notificationAccount: undefined,
      notificationLocation: undefined,
      notificationRevision: undefined,
      notificationLastEventAt: undefined,
      notificationEnabledAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = internalMutation({
  args: { ...target, generation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(ctx, args, "ownership:manage");
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (row && row.generation !== args.generation) stale();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const startDisconnect = internalMutation({
  args: { ...target, generation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(ctx, args, "ownership:manage");
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (!row || row.generation !== args.generation || row.disconnectingUntil)
      stale();
    await ctx.db.patch(row._id, {
      encryptedRefreshToken: undefined,
      notificationOperation: undefined,
      notificationAccount: undefined,
      notificationLocation: undefined,
      notificationRevision: undefined,
      notificationLastEventAt: undefined,
      notificationEnabledAt: undefined,
      stateHash: undefined,
      verifier: undefined,
      expiresAt: undefined,
      disconnectingUntil: Date.now() + 30_000,
    });
    await ctx.scheduler.runAfter(
      30_000,
      internal.googleBusiness.finishAbandonedDisconnect,
      args,
    );
    return null;
  },
});

export const finishAbandonedDisconnect = internalMutation({
  args: { ...target, generation: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("googleBusinessConnections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .unique();
    if (
      row &&
      row.generation === args.generation &&
      row.disconnectingUntil !== undefined &&
      row.disconnectingUntil <= Date.now()
    )
      await ctx.db.delete(row._id);
    return null;
  },
});
