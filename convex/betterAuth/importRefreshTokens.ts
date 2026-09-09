import { v } from "convex/values";
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
    await ctx.db.patch(args.id, { revoked: Date.now() });
    return true;
  },
});
