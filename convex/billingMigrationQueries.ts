import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

export const readOrganizationPage = internalQuery({
  args: {
    batchSize: v.number(),
    cursor: v.union(v.null(), v.string()),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("organizations")
      .paginate({ cursor: args.cursor, numItems: args.batchSize }),
});
