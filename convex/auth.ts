import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { magicLink, twoFactor } from "better-auth/plugins";
import { v } from "convex/values";

import authConfig from "./auth.config";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { hashInvitationToken, invitationLifetimeMs } from "./domain/invitation";
import { sendTransactionalEmail } from "./email/provider";
import {
  buildOrganizationInvitationEmail,
  buildResetPasswordEmail,
  buildVerificationEmail,
} from "./email/templates";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const authComponent = createClient<DataModel>(components.betterAuth);

function invitationMagicLinkMetadata(
  metadata: Record<string, unknown> | undefined,
) {
  if (!metadata) {
    throw new Error("A valid Invitation is required for this magic link.");
  }
  const invitationToken = metadata?.invitationToken;
  const deliveryIdempotencyKey = metadata?.deliveryIdempotencyKey;
  if (
    typeof invitationToken !== "string" ||
    typeof deliveryIdempotencyKey !== "string"
  ) {
    throw new Error("A valid Invitation is required for this magic link.");
  }
  return { deliveryIdempotencyKey, invitationToken };
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: "Convex Admin Starter",
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [siteUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendTransactionalEmail(buildResetPasswordEmail(user.email, url));
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendTransactionalEmail(buildVerificationEmail(user.email, url));
      },
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
    plugins: [
      twoFactor({ issuer: "Convex Admin Starter" }),
      magicLink({
        expiresIn: invitationLifetimeMs / 1_000,
        storeToken: "hashed",
        sendMagicLink: async ({ email, metadata, url }) => {
          const invitationMetadata = invitationMagicLinkMetadata(metadata);
          if (!("runMutation" in ctx)) {
            throw new Error("Magic links require a writable Convex context.");
          }
          const { deliveryIdempotencyKey, invitationToken } =
            invitationMetadata;
          const invitation = await ctx.runQuery(
            internal.invitationRecords.getMagicLinkDelivery,
            {
              tokenHash: await hashInvitationToken(invitationToken),
              email,
              deliveryIdempotencyKey,
              now: Date.now(),
            },
          );
          if (!invitation) {
            throw new Error("Invitation unavailable.");
          }
          try {
            const receipt = await sendTransactionalEmail(
              buildOrganizationInvitationEmail({
                email,
                organizationName: invitation.organizationName,
                role: invitation.role,
                url,
              }),
            );
            await ctx.runMutation(internal.invitationRecords.recordDelivery, {
              invitationId: invitation.invitationId,
              deliveryIdempotencyKey,
              status: "sent",
              provider: receipt.provider,
              providerMessageId: receipt.providerMessageId,
            });
          } catch (error) {
            await ctx.runMutation(internal.invitationRecords.recordDelivery, {
              invitationId: invitation.invitationId,
              deliveryIdempotencyKey,
              status: "failed",
              error:
                error instanceof Error
                  ? error.message.slice(0, 200)
                  : "Delivery failed.",
            });
            throw error;
          }
        },
      }),
      convex({ authConfig }),
    ],
  });
}

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      name: v.string(),
      email: v.string(),
      emailVerified: v.boolean(),
      image: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    if (!user) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (index) => index.eq("userId", String(user._id)))
      .unique();
    const uploadedImage = profile?.avatarStorageId
      ? await ctx.storage.getUrl(profile.avatarStorageId)
      : null;

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: uploadedImage ?? user.image ?? null,
    };
  },
});
