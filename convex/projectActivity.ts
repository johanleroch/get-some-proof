import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAccountBillingEntitlement } from "./billingEntitlements";

export async function isProjectOpen(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"organizations">,
) {
  if (project.deletionStartedAt !== undefined) return false;
  if (!project.accountId) return true;
  const account = await ctx.db.get(project.accountId);
  return Boolean(account && account.deletionStartedAt === undefined);
}

export async function isProjectActive(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"organizations">,
) {
  if (project.deletionStartedAt !== undefined) return false;
  if (!project.accountId) return true;
  const account = await ctx.db.get(project.accountId);
  if (!account || account.deletionStartedAt !== undefined) return false;
  const entitlement = await getAccountBillingEntitlement(ctx, account._id);
  if (entitlement.effectivePlan === "premium") return true;
  return (await resolveFreeProject(ctx, account))?._id === project._id;
}

export async function resolveFreeProject(
  ctx: QueryCtx | MutationCtx,
  account: Doc<"accounts">,
) {
  const selected = account.selectedFreeProjectId
    ? await ctx.db.get(account.selectedFreeProjectId)
    : null;
  if (
    selected?.accountId === account._id &&
    selected.deletionStartedAt === undefined
  ) {
    return selected;
  }
  const oldest = await ctx.db
    .query("organizations")
    .withIndex("by_account_open", (q) =>
      q.eq("accountId", account._id).eq("deletionStartedAt", undefined),
    )
    .first();
  return oldest;
}
