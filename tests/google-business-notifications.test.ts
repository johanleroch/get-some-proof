import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_BUSINESS_CLIENT_SECRET", "test-secret");
  vi.stubEnv(
    "GOOGLE_BUSINESS_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_REDIRECT_URI",
    "http://localhost:3000/api/google-business/callback",
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_PUBSUB_TOPIC",
    "projects/proof-test/topics/reviews",
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION",
    "projects/proof-test/subscriptions/reviews",
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_PUBSUB_AUDIENCE",
    "https://example.convex.site/google-business/pubsub",
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL",
    "push@proof-test.iam.gserviceaccount.com",
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function connectedProject() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const target = { organizationId: project.id };
  const state = new URL(
    await owner.client.action(api.googleBusinessActions.connect, target),
  ).searchParams.get("state")!;
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url) => {
      if (url.endsWith("/token"))
        return Response.json({
          access_token: "access",
          refresh_token: "refresh",
          scope: "https://www.googleapis.com/auth/business.manage",
        });
      if (url.includes("/reviews")) return Response.json({ reviews: [] });
      return Response.json({
        name: "accounts/12/notificationSetting",
        pubsubTopic: "projects/proof-test/topics/reviews",
        notificationTypes: ["NEW_REVIEW", "UPDATED_REVIEW"],
      });
    },
  );
  vi.stubGlobal("fetch", fetcher);
  await owner.client.action(api.googleBusinessActions.complete, {
    state,
    code: "code",
  });
  fetcher.mockClear();
  return { t, owner, project, target, fetcher };
}

it("requires the Owner's replacement acknowledgement before changing Google notifications", async () => {
  const { t, owner, target, fetcher } = await connectedProject();
  const args = {
    ...target,
    account: "accounts/12",
    location: "locations/34",
    replaceExisting: false,
  };
  await expect(
    owner.client.action(api.googleBusinessNotificationsActions.enable, args),
  ).rejects.toThrow(/confirm/i);
  expect(fetcher).not.toHaveBeenCalled();
  const other = await authenticatedUser(t, { email: "other@example.com" });
  await expect(
    other.client.action(api.googleBusinessNotificationsActions.enable, {
      ...args,
      replaceExisting: true,
    }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await owner.client.action(api.googleBusinessNotificationsActions.enable, {
    ...args,
    replaceExisting: true,
  });
  const patch = fetcher.mock.calls.find(
    ([, init]) => (init as RequestInit)?.method === "PATCH",
  );
  expect(patch?.[0]).toContain(
    "accounts/12/notificationSetting?updateMask=pubsubTopic,notificationTypes",
  );
  expect(JSON.parse((patch?.[1] as RequestInit).body as string)).toEqual({
    pubsubTopic: "projects/proof-test/topics/reviews",
    notificationTypes: ["NEW_REVIEW", "UPDATED_REVIEW"],
  });
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({
    notifications: {
      account: "accounts/12",
      location: "locations/34",
      revision: 0,
    },
  });
});

it("delivers each event once only to matching enabled locations, without retaining review contents", async () => {
  const { t, owner, target } = await connectedProject();
  await owner.client.action(api.googleBusinessNotificationsActions.enable, {
    ...target,
    account: "accounts/12",
    location: "locations/34",
    replaceExisting: true,
  });
  vi.useFakeTimers();
  const event = {
    messageId: "first",
    account: "accounts/12",
    location: "locations/34",
    publishedAt: Date.now(),
  };
  await t.mutation(internal.googleBusinessNotifications.receive, event);
  await vi.advanceTimersByTimeAsync(1);
  await t.finishInProgressScheduledFunctions();
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({
    notifications: { revision: 1, lastEventAt: event.publishedAt },
  });
  await t.mutation(internal.googleBusinessNotifications.receive, event);
  await t.mutation(internal.googleBusinessNotifications.receive, {
    ...event,
    messageId: "other-location",
    location: "locations/99",
  });
  await vi.advanceTimersByTimeAsync(1);
  await t.finishInProgressScheduledFunctions();
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({ notifications: { revision: 1 } });
  const records = await t.run((ctx) =>
    ctx.db.query("googleBusinessNotificationEvents").collect(),
  );
  expect(records).toHaveLength(1);
  expect(Object.keys(records[0]).sort()).toEqual(
    [
      "_creationTime",
      "_id",
      "account",
      "expiresAt",
      "location",
      "messageId",
      "publishedAt",
    ].sort(),
  );
  await owner.client.mutation(api.googleBusinessNotifications.disable, target);
  await t.mutation(internal.googleBusinessNotifications.receive, {
    ...event,
    messageId: "after-disable",
  });
  await vi.advanceTimersByTimeAsync(1);
  await t.finishInProgressScheduledFunctions();
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({ notifications: null, connected: true });
  await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60_000);
  await t.finishInProgressScheduledFunctions();
  expect(
    await t.run((ctx) =>
      ctx.db.query("googleBusinessNotificationEvents").collect(),
    ),
  ).toHaveLength(0);
});

it("does not reactivate updates when they were disabled during Google's in-flight response", async () => {
  const { owner, target } = await connectedProject();
  let release!: () => void;
  let patchStarted!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    patchStarted = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/token"))
        return Response.json({ access_token: "access" });
      if (url.includes("/reviews")) return Response.json({ reviews: [] });
      patchStarted();
      await waiting;
      return Response.json({
        pubsubTopic: "projects/proof-test/topics/reviews",
        notificationTypes: ["NEW_REVIEW", "UPDATED_REVIEW"],
      });
    }),
  );
  const enabling = owner.client.action(
    api.googleBusinessNotificationsActions.enable,
    {
      ...target,
      account: "accounts/12",
      location: "locations/34",
      replaceExisting: true,
    },
  );
  await started;
  await owner.client.mutation(api.googleBusinessNotifications.disable, target);
  release();
  await expect(enabling).rejects.toThrow(/changed/i);
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({ notifications: null });
});

it("authenticates a real signed push before delivering through the HTTP endpoint", async () => {
  const { generateKeyPair, exportJWK, SignJWT } = await import("jose");
  const { t, owner, target } = await connectedProject();
  await owner.client.action(api.googleBusinessNotificationsActions.enable, {
    ...target,
    account: "accounts/12",
    location: "locations/34",
    replaceExisting: true,
  });
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = {
    ...(await exportJWK(publicKey)),
    kid: "push-google",
    alg: "RS256",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://www.googleapis.com/oauth2/v3/certs");
      return Response.json({ keys: [key] });
    }),
  );
  const jwt = await new SignJWT({
    email: "push@proof-test.iam.gserviceaccount.com",
    email_verified: true,
  })
    .setProtectedHeader({ alg: "RS256", kid: "push-google" })
    .setIssuer("https://accounts.google.com")
    .setAudience("https://example.convex.site/google-business/pubsub")
    .setSubject("123")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  const body = JSON.stringify({
    subscription: "projects/proof-test/subscriptions/reviews",
    message: {
      messageId: "http-1",
      publishTime: new Date().toISOString(),
      data: Buffer.from(
        JSON.stringify({
          notificationType: "UPDATED_REVIEW",
          reviewName: "accounts/12/locations/34/reviews/review-1",
          locationName: "accounts/12/locations/34",
        }),
      ).toString("base64"),
    },
  });
  expect(
    (await t.fetch("/google-business/pubsub", { method: "POST", body })).status,
  ).toBe(401);
  expect(
    (
      await t.fetch("/google-business/pubsub", {
        method: "POST",
        body,
        headers: { Authorization: "Bearer invalid" },
      })
    ).status,
  ).toBe(401);
  vi.useFakeTimers();
  expect(
    (
      await t.fetch("/google-business/pubsub", {
        method: "POST",
        body,
        headers: { Authorization: `Bearer ${jwt}` },
      })
    ).status,
  ).toBe(204);
  await vi.advanceTimersByTimeAsync(1);
  await t.finishInProgressScheduledFunctions();
  expect(
    await owner.client.query(api.googleBusiness.status, target),
  ).toMatchObject({ notifications: { revision: 1 } });
});
