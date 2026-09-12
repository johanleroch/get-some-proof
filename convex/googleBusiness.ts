import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireOrganizationPermission } from "./security/organizationAccess";
import schema from "./schema";

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
    configured: v.boolean(),
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
      connected:
        !!row?.encryptedRefreshToken &&
        row.ownerId === access.principal.actorId,
      configured: !!(
        process.env.GOOGLE_BUSINESS_CLIENT_ID &&
        process.env.GOOGLE_BUSINESS_CLIENT_SECRET &&
        process.env.GOOGLE_BUSINESS_ENCRYPTION_KEY &&
        process.env.GOOGLE_BUSINESS_REDIRECT_URI
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
    if (row && Date.now() - row.updatedAt < 3000)
      throw new ConvexError({
        code: "GOOGLE_BUSY",
        message: "Wait a moment before connecting again.",
      });
    const fields = {
      ...args,
      encryptedRefreshToken:
        row?.ownerId === principal.actorId
          ? row.encryptedRefreshToken
          : undefined,
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
    if (!row || access.principal.actorId !== row.ownerId) stale();
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
      row.ownerId !== access.principal.actorId
    )
      stale();
    await ctx.db.patch(row._id, {
      encryptedRefreshToken: args.encryptedRefreshToken,
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
