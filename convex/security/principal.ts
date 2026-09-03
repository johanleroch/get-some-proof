import { ConvexError } from "convex/values";
import type { GenericCtx } from "@convex-dev/better-auth";

import type { DataModel } from "../_generated/dataModel";
import { authComponent } from "../auth";

export type Principal = {
  actorId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

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
