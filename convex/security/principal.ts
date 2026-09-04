import { ConvexError } from "convex/values";
import type { GenericCtx } from "@convex-dev/better-auth";

import type { DataModel } from "../_generated/dataModel";
import { components } from "../_generated/api";
import { authComponent } from "../auth";

export type Principal = {
  actorId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

const recentAuthenticationWindowMs = 5 * 60 * 1_000;

export async function requireRecentAuthentication(ctx: GenericCtx<DataModel>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.sessionId) {
    throw new ConvexError({
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before permanently deleting this Brand.",
    });
  }
  const session = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "_id", value: String(identity.sessionId) }],
  })) as { createdAt?: string | number | Date } | null;
  const createdAt = session?.createdAt
    ? new Date(session.createdAt).getTime()
    : Number.NaN;
  if (
    !Number.isFinite(createdAt) ||
    Date.now() - createdAt >= recentAuthenticationWindowMs
  ) {
    throw new ConvexError({
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before permanently deleting this Brand.",
    });
  }
}

export async function requirePrincipal(
  ctx: GenericCtx<DataModel>,
): Promise<Principal> {
  const user = await authComponent.getAuthUser(ctx);

  return {
    actorId: String(user._id),
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
  };
}

export async function requireVerifiedPrincipal(
  ctx: GenericCtx<DataModel>,
): Promise<Principal> {
  const principal = await requirePrincipal(ctx);

  if (!principal.emailVerified) {
    throw new ConvexError({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before entering an Organization.",
    });
  }

  return principal;
}
