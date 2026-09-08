import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import {
  hashSubmissionManagementToken,
  randomSubmissionManagementToken,
} from "./domain/submission";
import { verifyTurnstileToken } from "./turnstile";

const lifetimeMs = 10 * 60_000;
const limiter = new RateLimiter(components.rateLimiter, {
  collectionAdmissionGlobal: { kind: "fixed window", rate: 1000, period: HOUR },
  collectionAdmissionBrand: { kind: "fixed window", rate: 100, period: HOUR },
  collectionAdmissionFlow: { kind: "fixed window", rate: 3, period: HOUR },
});
function unavailable(): never {
  throw new ConvexError({
    code: "COLLECTION_ADMISSION_UNAVAILABLE",
    message: "Complete verification again to continue.",
  });
}
function validIdentity(publicSlug: string, clientSubmissionId: string) {
  return (
    publicSlug.length >= 2 &&
    publicSlug.length <= 48 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug) &&
    /^[a-zA-Z0-9_-]{8,100}$/.test(clientSubmissionId)
  );
}

export const issue = internalMutation({
  args: {
    publicSlug: v.string(),
    clientSubmissionId: v.string(),
    tokenHash: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (!validIdentity(args.publicSlug, args.clientSubmissionId)) unavailable();
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (q) => q.eq("publicSlug", args.publicSlug))
      .unique();
    if (!brand || brand.deletionStartedAt !== undefined) unavailable();
    for (const [name, key] of [
      ["collectionAdmissionGlobal", "global"],
      ["collectionAdmissionBrand", String(brand._id)],
      [
        "collectionAdmissionFlow",
        `${String(brand._id)}:${args.clientSubmissionId}`,
      ],
    ] as const) {
      if (!(await limiter.limit(ctx, name, { key })).ok) unavailable();
    }
    const expiresAt = Date.now() + lifetimeMs;
    const admissionId = await ctx.db.insert("collectionAdmissions", {
      organizationId: brand._id,
      clientSubmissionId: args.clientSubmissionId,
      tokenHash: args.tokenHash,
      expiresAt,
      imageUses: 0,
      avatarUses: 0,
      submissionUsed: false,
    });
    await ctx.scheduler.runAfter(
      lifetimeMs,
      internal.collectionAdmission.expire,
      { admissionId },
    );
    return expiresAt;
  },
});

export const create = action({
  args: {
    publicSlug: v.string(),
    clientSubmissionId: v.string(),
    turnstileToken: v.optional(v.string()),
  },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    if (!validIdentity(args.publicSlug, args.clientSubmissionId)) unavailable();
    await verifyTurnstileToken(args.turnstileToken, "collect_proof");
    const token = randomSubmissionManagementToken();
    const expiresAt = await ctx.runMutation(
      internal.collectionAdmission.issue,
      {
        publicSlug: args.publicSlug,
        clientSubmissionId: args.clientSubmissionId,
        tokenHash: await hashSubmissionManagementToken(token),
      },
    );
    return { token, expiresAt };
  },
});

export async function consumeAdmission(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">;
    clientSubmissionId: string;
    token?: string;
  },
  purpose: "image" | "avatar" | "submission",
) {
  if (!input.token || !/^[a-f0-9]{64}$/.test(input.token)) unavailable();
  const tokenHash = await hashSubmissionManagementToken(input.token);
  const admission = await ctx.db
    .query("collectionAdmissions")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !admission ||
    admission.organizationId !== input.organizationId ||
    admission.clientSubmissionId !== input.clientSubmissionId ||
    admission.expiresAt <= Date.now() ||
    admission.submissionUsed
  )
    unavailable();
  if (purpose === "submission") {
    await ctx.db.patch(admission._id, { submissionUsed: true });
  } else {
    const field = purpose === "image" ? "imageUses" : "avatarUses";
    if (admission[field] >= 3) unavailable();
    await ctx.db.patch(admission._id, { [field]: admission[field] + 1 });
  }
}

export const consumeSubmission = internalMutation({
  args: {
    publicSlug: v.string(),
    clientSubmissionId: v.string(),
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!validIdentity(args.publicSlug, args.clientSubmissionId)) unavailable();
    const brand = await ctx.db
      .query("organizations")
      .withIndex("by_public_slug", (q) => q.eq("publicSlug", args.publicSlug))
      .unique();
    if (!brand || brand.deletionStartedAt !== undefined) unavailable();
    await consumeAdmission(
      ctx,
      {
        organizationId: brand._id,
        clientSubmissionId: args.clientSubmissionId,
        token: args.token,
      },
      "submission",
    );
    return null;
  },
});

export const expire = internalMutation({
  args: { admissionId: v.id("collectionAdmissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admission = await ctx.db.get(args.admissionId);
    if (admission && admission.expiresAt <= Date.now())
      await ctx.db.delete(admission._id);
    return null;
  },
});
