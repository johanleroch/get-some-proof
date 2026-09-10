import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createImportOAuth } from "../convex/importOAuth";
import { api, components } from "../convex/_generated/api";
import {
  authenticatedUser,
  addStripeSubscription,
  createConvexTest,
} from "./convex-test-helpers";

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_oauth_connection");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_oauth_connection");
  vi.stubEnv("SITE_URL", "https://proof.example");
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "oauth-connection-fixture-secret-not-a-real-credential",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("serves bounded public client registration through the deployed HTTP route", async () => {
  const t = createConvexTest();
  const post = (value: unknown) =>
    t.fetch("/api/import-auth/oauth2/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  const response = await post({
    client_name: "Codex test client",
    redirect_uris: ["http://127.0.0.1:45231/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
  });
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const client = await response.json();
  expect(client.client_id).toBeTruthy();
  expect(client.client_secret).toBeUndefined();
  expect(
    (await post({ redirect_uris: ["http://public.example/callback"] })).status,
  ).toBe(400);
  expect((await post({ client_name: "x".repeat(17_000) })).status).toBe(413);
  expect((await t.fetch("/api/import-auth/oauth2/register")).status).toBe(404);
});

it("gates connection and one-time reuse attestation on the current paid account", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "MCP test studio",
  });
  expect(
    await owner.client.query(api.assistantImports.connectionStatus, {}),
  ).toEqual({ paid: false, activated: false });
  await expect(
    owner.client.mutation(api.assistantImports.activateConnection, {
      acceptReuseRights: true,
    }),
  ).rejects.toThrow(/Pro/);
  await addStripeSubscription(t, project.id, "active");
  await owner.client.mutation(api.assistantImports.activateConnection, {
    acceptReuseRights: true,
  });
  await owner.client.mutation(api.assistantImports.activateConnection, {
    acceptReuseRights: true,
  });
  expect(
    await owner.client.query(api.assistantImports.connectionStatus, {}),
  ).toEqual({ paid: true, activated: true });
  expect(
    await t.run((ctx) => ctx.db.query("assistantImportActivations").collect()),
  ).toHaveLength(1);
  await addStripeSubscription(t, project.id, "past_due", {
    eventCreated: Math.floor(Date.now() / 1000) + 1,
  });
  expect(
    await owner.client.query(api.assistantImports.connectionStatus, {}),
  ).toEqual({ paid: false, activated: true });
});

it("rejects a pre-revocation authorization code at the token endpoint after reconnecting", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  vi.spyOn(Date, "now").mockReturnValue(Date.now());
  const clientId = "code-revocation-fixture";
  const callback = "http://127.0.0.1:45231/callback";
  const verifier = "fixture-code-verifier-with-at-least-forty-three-characters";
  const scopes = ["testimonials:import", "offline_access"];
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthClient",
      data: {
        clientId,
        redirectUris: [callback],
        scopes,
        public: true,
        requirePKCE: true,
        tokenEndpointAuthMethod: "none",
        grantTypes: ["authorization_code", "refresh_token"],
      },
    },
  });
  const consent = () =>
    t.mutation(components.betterAuth.adapter.create, {
      input: {
        model: "importOAuthConsent",
        data: {
          clientId,
          userId: owner.actorId,
          scopes,
          createdAt: Date.now(),
        },
      },
    });
  const code = async (value: string) =>
    t.run(async (ctx) => {
      const auth = await createImportOAuth(ctx);
      await (
        await auth.$context
      ).internalAdapter.createVerificationValue({
        identifier: createHash("sha256").update(value).digest("base64url"),
        expiresAt: new Date(Date.now() + 60_000),
        value: JSON.stringify({
          type: "authorization_code",
          userId: owner.actorId,
          sessionId: owner.sessionId,
          query: {
            client_id: clientId,
            redirect_uri: callback,
            response_type: "code",
            scope: scopes.join(" "),
            code_challenge: createHash("sha256")
              .update(verifier)
              .digest("base64url"),
            code_challenge_method: "S256",
          },
        }),
      });
    });
  const exchange = (value: string) =>
    t.fetch("/api/import-auth/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: callback,
        code: value,
        code_verifier: verifier,
        resource: "https://proof.example/mcp",
      }).toString(),
    });
  await consent();
  await code("old-authorization-code");
  await owner.client.mutation(api.assistantImports.revokeConnection, {
    clientId,
  });
  await consent();
  const rejected = await exchange("old-authorization-code");
  expect(rejected.status).toBe(401);
  expect(await rejected.json()).toMatchObject({ error: "invalid_grant" });
  await code("new-authorization-code");
  const accepted = await exchange("new-authorization-code");
  expect(accepted.status).toBe(200);
  const tokens = await accepted.json();
  expect(tokens).toMatchObject({
    access_token: expect.any(String),
    refresh_token: expect.any(String),
  });
  const claims = JSON.parse(
    Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
  );
  expect(claims.import_grant_generation).toBe(1);
  expect(
    await t.query(components.betterAuth.importGrants.resolve, {
      actorId: owner.actorId,
      clientId,
      issuedAt: claims.iat * 1000,
      expiresAt: claims.exp * 1000,
      verifiedAt: Date.now(),
      generation: claims.import_grant_generation,
    }),
  ).not.toBeNull();
  const refreshed = await t.fetch("/api/import-auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: tokens.refresh_token,
      resource: "https://proof.example/mcp",
    }).toString(),
  });
  expect(refreshed.status).toBe(200);
  const rotated = await refreshed.json();
  expect(
    JSON.parse(
      Buffer.from(rotated.access_token.split(".")[1], "base64url").toString(),
    ).import_grant_generation,
  ).toBe(1);
  await owner.client.mutation(api.assistantImports.revokeConnection, {
    clientId,
  });
  expect(
    await t.query(components.betterAuth.importGrants.resolve, {
      actorId: owner.actorId,
      clientId,
      issuedAt: claims.iat * 1000,
      expiresAt: claims.exp * 1000,
      verifiedAt: Date.now(),
      generation: claims.import_grant_generation,
    }),
  ).toBeNull();
});
