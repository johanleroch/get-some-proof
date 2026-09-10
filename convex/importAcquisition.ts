import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

import { importChannel, importStage } from "./domain/testimonialImport";
type Channel = "public-web" | "chatgpt" | "workspace";
type Stage = "started" | "previewed" | "claimed" | "saved" | "published";
const day = 86_400_000;

/** One conversion per preview flow and stage, committed with the actual operation. */
export async function recordImportStage(
  ctx: MutationCtx,
  flowId: Id<"importAcquisitionFlows"> | undefined,
  stage: Stage,
) {
  if (!flowId) return;
  const flow = await ctx.db.get(flowId);
  if (!flow || flow.expiresAt <= Date.now() || flow.stages.includes(stage))
    return;
  await ctx.db.patch(flowId, { stages: [...flow.stages, stage] });
  const date = new Date(Date.now()).toISOString().slice(0, 10);
  const counter = await ctx.db
    .query("importAcquisitionDaily")
    .withIndex("by_day_channel_stage", (q) =>
      q.eq("day", date).eq("channel", flow.channel).eq("stage", stage),
    )
    .unique();
  if (counter) await ctx.db.patch(counter._id, { count: counter.count + 1 });
  else
    await ctx.db.insert("importAcquisitionDaily", {
      day: date,
      channel: flow.channel,
      stage,
      count: 1,
    });
}

export async function beginImportFlow(ctx: MutationCtx, channel: Channel) {
  const flowId = await ctx.db.insert("importAcquisitionFlows", {
    channel,
    stages: [],
    expiresAt: Date.now() + 90 * day,
  });
  await ctx.scheduler.runAfter(90 * day, internal.importAcquisition.expire, {
    flowId,
  });
  await recordImportStage(ctx, flowId, "started");
  return flowId;
}

export const expire = internalMutation({
  args: { flowId: v.id("importAcquisitionFlows") },
  returns: v.null(),
  handler: async (ctx, { flowId }) => {
    const flow = await ctx.db.get(flowId);
    if (flow && flow.expiresAt <= Date.now()) await ctx.db.delete(flowId);
    return null;
  },
});

/** Operator-only aggregate report; no user, URL, quote, token or conversation data. */
export const report = internalQuery({
  args: { from: v.string(), through: v.string() },
  returns: v.array(
    v.object({
      day: v.string(),
      channel: importChannel,
      stage: importStage,
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const from = Date.parse(args.from),
      through = Date.parse(args.through);
    if (
      ![args.from, args.through].every((value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value),
      ) ||
      !Number.isFinite(from + through) ||
      new Date(from).toISOString().slice(0, 10) !== args.from ||
      new Date(through).toISOString().slice(0, 10) !== args.through ||
      through < from ||
      through - from > 30 * day
    )
      throw new ConvexError({
        code: "INVALID_REPORT_RANGE",
        message: "Choose up to 31 UTC calendar days.",
      });
    const rows = await ctx.db
      .query("importAcquisitionDaily")
      .withIndex("by_day_channel_stage", (q) =>
        q.gte("day", args.from).lte("day", args.through),
      )
      .take(465);
    return rows.map(({ day, channel, stage, count }) => ({
      day,
      channel,
      stage,
      count,
    }));
  },
});
