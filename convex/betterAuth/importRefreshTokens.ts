import { v } from "convex/values";
import { parseImportGrantGeneration } from "../importOAuthOptions";
import { mutation } from "./_generated/server";

/** Atomic compare-and-set needed by Better Auth's refresh-token rotation. */
export const consume = mutation({
  args: { id: v.id("importOAuthRefreshToken") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.id);
    if (
      !token ||
      token.revoked != null ||
      (token.expiresAt != null && token.expiresAt <= Date.now())
    )
      return false;
    const revocation = await ctx.db
      .query("importOAuthRevocations")
      .withIndex("by_clientId_and_userId", (q) =>
        q.eq("clientId", token.clientId).eq("userId", token.userId),
      )
      .unique();
    const generation = parseImportGrantGeneration(token.referenceId);
    if (generation !== undefined) {
      if (generation !== (revocation?.generation ?? (revocation ? 1 : 0)))
        return false;
    } else if (
      revocation &&
      (token.createdAt ?? token._creationTime) <= revocation.revokedAt
    )
      return false;
    await ctx.db.patch(args.id, { revoked: Date.now() });
    return true;
  },
});
