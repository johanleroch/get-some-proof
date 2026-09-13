"use node";
import { randomUUID } from "node:crypto";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { z } from "zod";
import { action, env } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { decrypt, failure, request, token } from "./lib/googleBusinessClient";

const limiter = new RateLimiter(components.rateLimiter, {
  googleNotificationSettings: { kind: "fixed window", rate: 5, period: MINUTE },
});

export const enable = action({
  args: {
    organizationId: v.id("organizations"),
    account: v.string(),
    location: v.string(),
    replaceExisting: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.replaceExisting)
      failure(
        "Confirm that automatic updates may replace another tool's Google notifications.",
      );
    if (
      !/^accounts\/[0-9]+$/.test(args.account) ||
      !/^locations\/[0-9]+$/.test(args.location)
    )
      failure("Choose a Google account and verified location first.");
    const connection = await ctx.runQuery(internal.googleBusiness.credentials, {
      organizationId: args.organizationId,
    });
    if (!connection.encryptedRefreshToken) failure("Connect Google first.");
    const topic = env.GOOGLE_BUSINESS_PUBSUB_TOPIC;
    if (
      !topic ||
      !/^projects\/[a-z0-9-]+\/topics\/[A-Za-z][A-Za-z0-9._~+%-]*$/.test(
        topic,
      ) ||
      !env.GOOGLE_BUSINESS_PUBSUB_AUDIENCE ||
      !env.GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION ||
      !env.GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL
    )
      failure("Automatic Google updates are not configured yet.");
    const limit = await limiter.limit(ctx, "googleNotificationSettings", {
      key: connection.ownerId,
    });
    if (!limit.ok) failure("Too many changes. Try again in a minute.");
    const operation = randomUUID();
    await ctx.runMutation(internal.googleBusinessNotifications.begin, {
      organizationId: args.organizationId,
      generation: connection.generation,
      operation,
    });
    const auth = await token({
      grant_type: "refresh_token",
      refresh_token: decrypt(
        connection.encryptedRefreshToken,
        args.organizationId,
      ),
    });
    const headers = {
      Authorization: `Bearer ${auth.access_token}`,
      "Content-Type": "application/json",
    };
    // Verify access to the selected, verified location before changing account settings.
    await request(
      `https://mybusiness.googleapis.com/v4/${args.account}/${args.location}/reviews?pageSize=1`,
      { headers },
    );
    const notificationTypes = ["NEW_REVIEW", "UPDATED_REVIEW"];
    const result = await request(
      `https://mybusinessnotifications.googleapis.com/v1/${args.account}/notificationSetting?updateMask=pubsubTopic,notificationTypes`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ pubsubTopic: topic, notificationTypes }),
      },
    );
    const parsed = z
      .object({
        pubsubTopic: z.literal(topic),
        notificationTypes: z.array(z.string()),
      })
      .safeParse(result);
    if (
      !parsed.success ||
      !notificationTypes.every((type) =>
        parsed.data.notificationTypes.includes(type),
      )
    )
      failure(
        "Google did not confirm automatic updates. Try enabling them again.",
      );
    await ctx.runMutation(internal.googleBusinessNotifications.save, {
      organizationId: args.organizationId,
      generation: connection.generation,
      operation,
      account: args.account,
      location: args.location,
    });
    return null;
  },
});
