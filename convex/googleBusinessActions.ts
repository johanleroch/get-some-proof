"use node";

import { createHash, randomBytes } from "node:crypto";
import {
  failure,
  config,
  encrypt,
  decrypt,
  request,
  token,
} from "./lib/googleBusinessClient";
import { v, type Infer } from "convex/values";
import { z } from "zod";
import { action, internalAction } from "./_generated/server";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";

const readLimiter = new RateLimiter(components.rateLimiter, {
  googleReviewReads: { kind: "fixed window", rate: 30, period: MINUTE },
});

const scope = "https://www.googleapis.com/auth/business.manage";
const target = { organizationId: v.id("organizations") };
export const connect = action({
  args: target,
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const settings = config();
    const state = randomBytes(32).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    await ctx.runMutation(internal.googleBusiness.begin, {
      ...args,
      stateHash: createHash("sha256").update(state).digest("hex"),
      verifier,
      generation: randomBytes(16).toString("hex"),
    });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return url.toString();
  },
});

export const complete = action({
  args: { state: v.string(), code: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    if (
      !/^[a-f0-9]{64}$/.test(args.state) ||
      !args.code ||
      args.code.length > 4096
    )
      failure("This Google authorization is invalid. Connect again.");
    const pending = await ctx.runMutation(internal.googleBusiness.consume, {
      stateHash: createHash("sha256").update(args.state).digest("hex"),
    });
    const credentials = await token({
      grant_type: "authorization_code",
      code: args.code,
      code_verifier: pending.verifier,
      redirect_uri: config().redirectUri,
    });
    if (
      !credentials.refresh_token ||
      !credentials.scope?.split(" ").includes(scope)
    )
      failure("Allow Business Profile access to connect your reviews.");
    await ctx.runMutation(internal.googleBusiness.save, {
      organizationId: pending.organizationId,
      generation: pending.generation,
      encryptedRefreshToken: encrypt(
        credentials.refresh_token,
        pending.organizationId,
      ),
    });
    return pending.slug;
  },
});

const item = v.object({
  name: v.string(),
  title: v.string(),
  comment: v.optional(v.string()),
  rating: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
});
const pageResult = v.object({
  items: v.array(item),
  nextPageToken: v.union(v.string(), v.null()),
  totalReviewCount: v.optional(v.number()),
  averageRating: v.optional(v.number()),
});
const pagination = { nextPageToken: z.string().max(4096).optional() };
const accountSchema = z.object({
  ...pagination,
  accounts: z
    .array(
      z.object({
        name: z.string().regex(/^accounts\/[0-9]+$/),
        accountName: z.string(),
      }),
    )
    .max(50)
    .optional(),
});
const locationSchema = z.object({
  ...pagination,
  locations: z
    .array(
      z.object({
        name: z.string().regex(/^locations\/[0-9]+$/),
        title: z.string(),
      }),
    )
    .max(50)
    .optional(),
});
const reviewSchema = z.object({
  ...pagination,
  reviews: z
    .array(
      z.object({
        reviewId: z.string(),
        reviewer: z
          .object({
            displayName: z.string().optional(),
            isAnonymous: z.boolean().optional(),
          })
          .optional(),
        comment: z.string().optional(),
        starRating: z.enum([
          "STAR_RATING_UNSPECIFIED",
          "ONE",
          "TWO",
          "THREE",
          "FOUR",
          "FIVE",
        ]),
        updateTime: z.string().optional(),
      }),
    )
    .max(50)
    .optional(),
  totalReviewCount: z.number().optional(),
  averageRating: z.number().optional(),
});

export const read = action({
  args: {
    ...target,
    account: v.optional(v.string()),
    location: v.optional(v.string()),
    pageToken: v.optional(v.string()),
  },
  returns: pageResult,
  handler: async (ctx, args): Promise<Infer<typeof pageResult>> => {
    if (
      (args.account && !/^accounts\/[0-9]+$/.test(args.account)) ||
      (args.location &&
        (!args.account || !/^locations\/[0-9]+$/.test(args.location))) ||
      (args.pageToken?.length ?? 0) > 4096
    )
      failure("Choose a Google account and location from the list.");
    const connection = await ctx.runQuery(internal.googleBusiness.credentials, {
      organizationId: args.organizationId,
    });
    if (!connection.encryptedRefreshToken) failure("Connect Google first.");
    const limit = await readLimiter.limit(ctx, "googleReviewReads", {
      key: connection.ownerId,
    });
    if (!limit.ok) failure("Too many Google requests. Try again in a minute.");
    const credentials = await token({
      grant_type: "refresh_token",
      refresh_token: decrypt(
        connection.encryptedRefreshToken,
        args.organizationId,
      ),
    });
    const url = new URL(
      args.location
        ? `https://mybusiness.googleapis.com/v4/${args.account}/${args.location}/reviews`
        : args.account
          ? `https://mybusinessbusinessinformation.googleapis.com/v1/${args.account}/locations`
          : "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    );
    url.searchParams.set("pageSize", args.account ? "50" : "20");
    if (args.location) url.searchParams.set("orderBy", "updateTime desc");
    if (args.account && !args.location)
      url.searchParams.set("readMask", "name,title");
    if (args.pageToken) url.searchParams.set("pageToken", args.pageToken);
    const body = await request(url.toString(), {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
    // Recheck after network IO so a concurrent disconnect cannot return stale data.
    const current = await ctx.runQuery(internal.googleBusiness.credentials, {
      organizationId: args.organizationId,
    });
    if (current.generation !== connection.generation)
      failure("The Google connection changed. Load the list again.");
    if (args.location) {
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success)
        failure("Google returned unreadable reviews. Try again.");
      return {
        items: (parsed.data.reviews ?? []).map((r) => ({
          name: r.reviewId,
          title: r.reviewer?.isAnonymous
            ? "Anonymous reviewer"
            : (r.reviewer?.displayName ?? "Google reviewer"),
          comment: r.comment,
          rating: r.starRating,
          updatedAt: r.updateTime,
        })),
        nextPageToken: parsed.data.nextPageToken ?? null,
        totalReviewCount: parsed.data.totalReviewCount,
        averageRating: parsed.data.averageRating,
      };
    }
    if (args.account) {
      const parsed = locationSchema.safeParse(body);
      if (!parsed.success)
        failure("Google returned unreadable locations. Try again.");
      return {
        items: (parsed.data.locations ?? []).map((l) => ({
          name: l.name,
          title: l.title,
        })),
        nextPageToken: parsed.data.nextPageToken ?? null,
      };
    }
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success)
      failure("Google returned unreadable accounts. Try again.");
    return {
      items: (parsed.data.accounts ?? []).map((a) => ({
        name: a.name,
        title: a.accountName,
      })),
      nextPageToken: parsed.data.nextPageToken ?? null,
    };
  },
});

export const disconnect = action({
  args: target,
  returns: v.object({ revoked: v.boolean() }),
  handler: async (ctx, args): Promise<{ revoked: boolean }> => {
    const connection = await ctx.runQuery(
      internal.googleBusiness.credentials,
      args,
    );
    await ctx.runMutation(internal.googleBusiness.startDisconnect, {
      ...args,
      generation: connection.generation,
    });
    let revoked = !connection.encryptedRefreshToken;
    try {
      if (!connection.encryptedRefreshToken) return { revoked };
      const response = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: decrypt(connection.encryptedRefreshToken, args.organizationId),
        }).toString(),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      revoked = response.ok;
      return { revoked };
    } catch {
      return { revoked: false };
    } finally {
      await ctx.runMutation(internal.googleBusiness.remove, {
        ...args,
        generation: connection.generation,
      });
    }
  },
});

export const revokeDeletedConnection = internalAction({
  args: { organizationId: v.string(), encryptedRefreshToken: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decrypt(args.encryptedRefreshToken, args.organizationId),
      }).toString(),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok && response.status !== 400)
      failure("Google permission revocation needs a retry.");
    return null;
  },
});
