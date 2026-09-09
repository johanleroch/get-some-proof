import { expect, it } from "vitest";
import { components } from "../convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";
import { importOAuthScope } from "../convex/importOAuthOptions";

it("consumes an active refresh token once under concurrency and rejects expired grants", async () => {
  const t = createConvexTest();
  const { actorId } = await authenticatedUser(t);
  const active = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthRefreshToken",
      data: {
        token: "fixture-token-hash",
        clientId: "fixture-client",
        userId: actorId,
        scopes: [importOAuthScope],
        expiresAt: Date.now() + 60_000,
      },
    },
  });
  const consume = () =>
    t.mutation(components.betterAuth.importRefreshTokens.consume, {
      id: String(active._id),
    });
  const outcomes = await Promise.all([consume(), consume()]);
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  expect(await consume()).toBe(false);
  const expired = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthRefreshToken",
      data: {
        token: "expired-fixture-token-hash",
        clientId: "fixture-client",
        userId: actorId,
        scopes: [importOAuthScope],
        expiresAt: Date.now() - 1,
        revoked: null,
      },
    },
  });
  expect(
    await t.mutation(components.betterAuth.importRefreshTokens.consume, {
      id: String(expired._id),
    }),
  ).toBe(false);
});

it("stores import grants separately from legacy consent and enforces client uniqueness", async () => {
  const t = createConvexTest();
  const { actorId } = await authenticatedUser(t);
  const client = {
    model: "importOAuthClient" as const,
    data: {
      clientId: "chatgpt-fixture-client",
      userId: actorId,
      redirectUris: ["https://client.example/oauth/callback"],
      scopes: [importOAuthScope],
      requirePKCE: true,
      public: true,
    },
  };
  await t.mutation(components.betterAuth.adapter.create, { input: client });
  await expect(
    t.mutation(components.betterAuth.adapter.create, { input: client }),
  ).rejects.toThrow();
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "oauthConsent",
      data: {
        clientId: client.data.clientId,
        userId: actorId,
        scopes: "legacy-scope",
        consentGiven: true,
      },
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId: client.data.clientId,
        userId: actorId,
        scopes: [importOAuthScope],
        createdAt: Date.now(),
      },
    },
  });
  const where = [{ field: "clientId" as const, value: client.data.clientId }];
  expect(
    await t.query(components.betterAuth.adapter.findOne, {
      model: "importOAuthConsent",
      where,
    }),
  ).toMatchObject({ scopes: [importOAuthScope], userId: actorId });
  expect(
    await t.query(components.betterAuth.adapter.findOne, {
      model: "oauthConsent",
      where,
    }),
  ).toMatchObject({ scopes: "legacy-scope", consentGiven: true });
});

it("requires current client consent and a verified existing account", async () => {
  const t = createConvexTest();
  const { actorId } = await authenticatedUser(t);
  const args = {
    actorId,
    clientId: "policy-fixture",
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 900_000,
  };
  const resolve = () =>
    t.query(components.betterAuth.importGrants.resolve, args);
  expect(await resolve()).toBeNull();
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthClient",
      data: {
        clientId: args.clientId,
        redirectUris: ["https://client.example/callback"],
        scopes: [importOAuthScope],
      },
    },
  });
  expect(await resolve()).toBeNull();
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId: args.clientId,
        userId: actorId,
        scopes: [importOAuthScope],
      },
    },
  });
  expect(await resolve()).toMatchObject({ actorId, emailVerified: true });
  expect(
    await t.query(components.betterAuth.importGrants.resolve, {
      ...args,
      expiresAt: args.verifiedAt,
    }),
  ).toBeNull();
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthClient",
      where: [{ field: "clientId", value: args.clientId }],
      update: { disabled: true },
    },
  });
  expect(await resolve()).toBeNull();
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthClient",
      where: [{ field: "clientId", value: args.clientId }],
      update: { disabled: false },
    },
  });
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "user",
      where: [{ field: "_id", value: actorId }],
      update: { emailVerified: false },
    },
  });
  expect(await resolve()).toBeNull();
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "user",
      where: [{ field: "_id", value: actorId }],
      update: { emailVerified: true },
    },
  });
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [{ field: "clientId", value: args.clientId }],
      update: { scopes: [] },
    },
  });
  expect(await resolve()).toBeNull();
});
