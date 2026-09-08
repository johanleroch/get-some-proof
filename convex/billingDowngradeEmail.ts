import { v } from "convex/values";

import { internal } from "./_generated/api";
import { env, internalAction, internalMutation } from "./_generated/server";
import { resolveFreeProject } from "./projectActivity";
import {
  getAccountBillingEntitlement,
  getOrganizationBillingEntitlement,
} from "./billingEntitlements";
import { buildBillingLifecycleEmail } from "./email/templates";
import {
  sendTransactionalEmail,
  UncertainEmailDeliveryError,
} from "./email/provider";

const LEASE_MS = 5 * 60 * 1_000;
const MAX_ATTEMPTS = 5;

const kindValidator = v.union(
  v.literal("downgrade_d7"),
  v.literal("downgrade_d1"),
  v.literal("video_retention_started"),
  v.literal("video_retention_d7"),
  v.literal("video_retention_d1"),
);

export const reserveLifecycleEmail = internalMutation({
  args: { emailId: v.id("billingLifecycleEmails"), leaseId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      brandName: v.string(),
      deliveryKey: v.string(),
      email: v.string(),
      kind: kindValidator,
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email || email.status === "sent" || email.status === "skipped") {
      return null;
    }
    const now = Date.now();
    if (email.scheduledFor > now) {
      await ctx.scheduler.runAt(
        email.scheduledFor,
        internal.billingDowngradeEmail.deliverLifecycleEmail,
        { emailId: email._id },
      );
      return null;
    }
    if (email.status === "sending" && (email.leaseExpiresAt ?? 0) > now) {
      return null;
    }
    const transition = await ctx.db.get(email.transitionId);
    const account = transition?.accountId
      ? await ctx.db.get(transition.accountId)
      : null;
    const originalProject = await ctx.db.get(email.organizationId);
    const organization =
      originalProject?.deletionStartedAt === undefined && originalProject
        ? originalProject
        : account
          ? await resolveFreeProject(ctx, account)
          : null;
    const entitlement = account
      ? await getAccountBillingEntitlement(ctx, account._id)
      : await getOrganizationBillingEntitlement(ctx, email.organizationId);
    const isDowngradeReminder = email.kind.startsWith("downgrade_");
    const activeRetentions = transition
      ? await ctx.db
          .query("videoDowngradeRetentions")
          .withIndex("by_transition_status_expiry", (index) =>
            index.eq("transitionId", transition._id).eq("status", "retained"),
          )
          .take(1)
      : [];
    if (
      !transition ||
      !organization ||
      account?.deletionStartedAt !== undefined ||
      (isDowngradeReminder &&
        (transition.version !== email.transitionVersion ||
          transition.status !== "scheduled" ||
          entitlement.subscription?.stripeSubscriptionId !==
            transition.stripeSubscriptionId)) ||
      (!isDowngradeReminder && activeRetentions.length === 0)
    ) {
      await ctx.db.patch(email._id, { status: "skipped", updatedAt: now });
      return null;
    }
    const owner = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (index) =>
        index
          .eq("organizationId", organization._id)
          .eq("userId", organization.createdByUserId),
      )
      .unique();
    const profile = account
      ? await ctx.db
          .query("billingProfiles")
          .withIndex("by_account", (q) => q.eq("accountId", account._id))
          .unique()
      : null;
    const recipientEmail = profile?.billingEmail ?? owner?.email;
    if (!recipientEmail) {
      await ctx.db.patch(email._id, { status: "skipped", updatedAt: now });
      return null;
    }
    await ctx.db.patch(email._id, {
      attempts: email.attempts + 1,
      leaseExpiresAt: now + LEASE_MS,
      leaseId: args.leaseId,
      recipientEmail,
      status: "sending",
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      LEASE_MS,
      internal.billingDowngradeEmail.deliverLifecycleEmail,
      { emailId: email._id },
    );
    return {
      brandName: organization.name,
      deliveryKey: email.deliveryKey,
      email: recipientEmail,
      kind: email.kind,
      slug: organization.slug,
    };
  },
});

export const completeLifecycleEmail = internalMutation({
  args: {
    emailId: v.id("billingLifecycleEmails"),
    leaseId: v.string(),
    provider: v.string(),
    providerMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (email?.status === "sending" && email.leaseId === args.leaseId) {
      await ctx.db.patch(email._id, {
        lastError: undefined,
        leaseExpiresAt: undefined,
        leaseId: undefined,
        provider: args.provider,
        providerMessageId: args.providerMessageId,
        status: "sent",
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const failLifecycleEmail = internalMutation({
  args: {
    emailId: v.id("billingLifecycleEmails"),
    error: v.string(),
    leaseId: v.string(),
    uncertain: v.boolean(),
  },
  returns: v.object({ retry: v.boolean() }),
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (
      !email ||
      email.status !== "sending" ||
      email.leaseId !== args.leaseId
    ) {
      return { retry: false };
    }
    const retry = !args.uncertain && email.attempts < MAX_ATTEMPTS;
    await ctx.db.patch(email._id, {
      lastError: args.error,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      status: retry ? "failed" : "skipped",
      updatedAt: Date.now(),
    });
    if (retry) {
      await ctx.scheduler.runAfter(
        60_000,
        internal.billingDowngradeEmail.deliverLifecycleEmail,
        { emailId: email._id },
      );
    }
    return { retry };
  },
});

export const deliverLifecycleEmail = internalAction({
  args: { emailId: v.id("billingLifecycleEmails") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const leaseId = crypto.randomUUID();
    const reserved = await ctx.runMutation(
      internal.billingDowngradeEmail.reserveLifecycleEmail,
      { ...args, leaseId },
    );
    if (!reserved) return null;
    try {
      const receipt = await sendTransactionalEmail({
        ...buildBillingLifecycleEmail({
          brandName: reserved.brandName,
          email: reserved.email,
          kind: reserved.kind,
          url: `${env.SITE_URL}/org/${reserved.slug}/billing`,
        }),
        idempotencyKey: reserved.deliveryKey,
      });
      await ctx.runMutation(
        internal.billingDowngradeEmail.completeLifecycleEmail,
        {
          ...args,
          leaseId,
          provider: receipt.provider,
          providerMessageId: receipt.providerMessageId,
        },
      );
    } catch (error) {
      const result = await ctx.runMutation(
        internal.billingDowngradeEmail.failLifecycleEmail,
        {
          ...args,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : "Lifecycle email delivery failed.",
          leaseId,
          uncertain: error instanceof UncertainEmailDeliveryError,
        },
      );
      void result;
    }
    return null;
  },
});
