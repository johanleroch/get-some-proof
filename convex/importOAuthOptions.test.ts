// @vitest-environment node
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { expect, it } from "vitest";
import {
  createImportOAuthOptions,
  importOAuthBasePath,
  importOAuthScope,
  assistantOAuthScope,
} from "./importOAuthOptions";

import { verifyImportAccessToken } from "./domain/importAccessToken";

const origin = "https://proof.example";
const callback = "https://client.example/oauth/callback";

it.each([
  "valid",
  "Claude refresh",
  "legacy Free",
  "revoked code",
  "unpaid",
  "wrong verifier",
  "wrong resource",
  "wrong redirect",
  "missing challenge",
  "plain challenge",
])("enforces the consented import grant: %s", async (scenario) => {
  const requestedScope =
    scenario === "unpaid"
      ? assistantOAuthScope
      : scenario === "Claude refresh"
        ? `${assistantOAuthScope} offline_access`
        : importOAuthScope;
  let codeRevoked = false;
  const auth = betterAuth({
    ...createImportOAuthOptions({
      siteUrl: origin,
      canExchangeCode: async (_actorId, _clientId, issuedAt) =>
        Number.isFinite(issuedAt) && !codeRevoked,
      ...(["unpaid", "legacy Free"].includes(scenario)
        ? { canConnect: async () => false }
        : {}),
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
        jwks: [],
        importOAuthClient: [],
        importOAuthConsent: [],
        importOAuthAccessToken: [],
        importOAuthRefreshToken: [],
      }),
      secret: "test-only-import-oauth-secret-not-used-outside-tests",
    }),
    // Only this isolated fixture creates users; the real instance reuses the
    // website's existing users and login session in the component adapter.
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
  });
  const signup = await auth.api.signUpEmail({
    body: {
      name: "Maya Laurent",
      email: "maya@juniper.example",
      password: "test-fixture-password-8364",
    },
    asResponse: true,
  });
  expect(signup.status).toBe(200);
  await (
    await auth.$context
  ).internalAdapter.updateUser((await signup.clone().json()).user.id, {
    emailVerified: true,
  });
  const cookie = signup.headers
    .getSetCookie()
    .map((part) => part.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie, origin });
  const client =
    scenario === "Claude refresh"
      ? await (
          await auth.handler(
            new Request(`${origin}${importOAuthBasePath}/oauth2/register`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                client_name: "Claude Code compatibility fixture",
                redirect_uris: [callback],
                token_endpoint_auth_method: "none",
                grant_types: ["authorization_code", "refresh_token"],
                scope: assistantOAuthScope,
              }),
            }),
          )
        ).json()
      : await auth.api.createOAuthClient({
          headers,
          body: {
            client_name: "Import integration test",
            redirect_uris: [callback],
            scope: requestedScope,
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code"],
          },
        });
  const verifier = "test-pkce-verifier-with-at-least-forty-three-characters";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const query = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: callback,
    response_type: "code",
    scope: requestedScope,
    resource: `${origin}/mcp`,
    state: "test-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (scenario === "missing challenge") {
    query.delete("code_challenge");
    query.delete("code_challenge_method");
  }
  if (scenario === "plain challenge")
    query.set("code_challenge_method", "plain");
  const authorize = await auth.handler(
    new Request(`${origin}${importOAuthBasePath}/oauth2/authorize?${query}`, {
      headers,
    }),
  );
  if (scenario === "unpaid") {
    expect(authorize.status).toBe(403);
    return;
  }
  if (scenario === "plain challenge") {
    expect(authorize.status).toBe(400);
    expect(authorize.headers.get("location")).toBeNull();
    return;
  }
  expect(authorize.status).toBe(302);
  const consentLocation = new URL(authorize.headers.get("location")!);
  if (scenario === "missing challenge") {
    expect(consentLocation.searchParams.has("error")).toBe(true);
    expect(consentLocation.searchParams.has("code")).toBe(false);
    return;
  }
  expect(consentLocation.pathname).toBe("/import/authorize");
  expect(consentLocation.searchParams.has("code")).toBe(false);
  const consentHeaders = new Headers(headers);
  consentHeaders.set("content-type", "application/json");
  const consentResponse = await auth.handler(
    new Request(`${origin}${importOAuthBasePath}/oauth2/consent`, {
      method: "POST",
      headers: consentHeaders,
      body: JSON.stringify({
        accept: true,
        oauth_query: consentLocation.search.slice(1),
      }),
    }),
  );
  expect(consentResponse.status).toBe(200);
  const consent = await consentResponse.json();
  expect(consent).toHaveProperty("url");
  const redirect = new URL(consent.url);
  expect(`${redirect.origin}${redirect.pathname}`).toBe(callback);
  expect(redirect.searchParams.get("state")).toBe("test-state");
  const code = redirect.searchParams.get("code");
  expect(code).toBeTruthy();
  const exchange = async (codeVerifier: string) =>
    auth.handler(
      new Request(`${origin}${importOAuthBasePath}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: client.client_id,
          redirect_uri:
            scenario === "wrong redirect"
              ? "https://elsewhere.example/callback"
              : callback,
          code: code!,
          code_verifier: codeVerifier,
          resource:
            scenario === "wrong resource"
              ? `${origin}/api/account`
              : `${origin}/mcp`,
        }),
      }),
    );
  if (scenario === "revoked code") codeRevoked = true;
  const tokenResponse = await exchange(
    scenario === "wrong verifier" ? `${verifier}-incorrect` : verifier,
  );
  if (!["valid", "legacy Free", "Claude refresh"].includes(scenario)) {
    expect(tokenResponse.status).toBeGreaterThanOrEqual(400);
    expect(tokenResponse.status).toBeLessThan(500);
    expect(await tokenResponse.json()).not.toHaveProperty("access_token");
    return;
  }
  expect(tokenResponse.status).toBe(200);
  const token = await tokenResponse.json();
  const claims = JSON.parse(
    Buffer.from(token.access_token.split(".")[1], "base64url").toString(),
  );
  expect(claims).toMatchObject({
    iss: `${origin}${importOAuthBasePath}`,
    aud: `${origin}/mcp`,
    scope: requestedScope,
  });
  if (scenario === "Claude refresh") {
    expect(token.refresh_token).toEqual(expect.any(String));
    expect(
      await verifyImportAccessToken(
        `Bearer ${token.access_token}`,
        auth.api.verifyJWT,
        assistantOAuthScope,
      ),
    ).toMatchObject({ actorId: claims.sub, clientId: client.client_id });
    return;
  }
  expect(
    await verifyImportAccessToken(
      `Bearer ${token.access_token}`,
      auth.api.verifyJWT,
    ),
  ).toMatchObject({ actorId: claims.sub, clientId: client.client_id });
  const deniedPayloads = [
    { ...claims, iss: "https://foreign.example" },
    { ...claims, aud: `${origin}/api/account` },
    { ...claims, scope: "testimonials:import:admin" },
    { ...claims, azp: "" },
    { ...claims, exp: claims.iat - 1 },
    { ...claims, iat: claims.iat + 120, exp: claims.exp + 120 },
    { ...claims, exp: claims.iat + 3600 },
  ];
  for (const payload of deniedPayloads) {
    const signed = await auth.api.signJWT({ body: { payload } });
    expect(
      await verifyImportAccessToken(
        `Bearer ${signed.token}`,
        auth.api.verifyJWT,
      ),
    ).toBeNull();
  }
  const parts = token.access_token.split(".");
  parts[1] = Buffer.from(
    JSON.stringify({ ...claims, sub: "someone-else" }),
  ).toString("base64url");
  expect(
    await verifyImportAccessToken(
      `Bearer ${parts.join(".")}`,
      auth.api.verifyJWT,
    ),
  ).toBeNull();
  expect(claims).not.toHaveProperty("sessionId");
  expect(claims.exp - claims.iat).toBe(15 * 60);
  const [encodedHeader, encodedPayload, encodedSignature] =
    token.access_token.split(".");
  const keyId = JSON.parse(
    Buffer.from(encodedHeader, "base64url").toString(),
  ).kid;
  const jwksResponse = await auth.handler(
    new Request(`${origin}${importOAuthBasePath}/jwks`),
  );
  const jwks = await jwksResponse.json();
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwks.keys.find((key: { kid: string }) => key.kid === keyId),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  expect(
    await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      Buffer.from(encodedSignature, "base64url"),
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
    ),
  ).toBe(true);
  expect((await exchange(verifier)).status).toBe(401);
  expect(
    (
      await auth.handler(
        new Request(`${origin}${importOAuthBasePath}/token`, { headers }),
      )
    ).status,
  ).toBe(404);
});

it("registers a public MCP client with a loopback callback and requires PKCE", async () => {
  const auth = betterAuth({
    ...createImportOAuthOptions({
      siteUrl: origin,
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
        jwks: [],
        importOAuthClient: [],
        importOAuthConsent: [],
        importOAuthAccessToken: [],
        importOAuthRefreshToken: [],
      }),
      secret: "test-only-import-oauth-secret-not-used-outside-tests",
    }),
    rateLimit: { enabled: false },
  });
  const register = (extra: Record<string, unknown> = {}) =>
    auth.handler(
      new Request(`${origin}${importOAuthBasePath}/oauth2/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "Local MCP integration test",
          redirect_uris: ["http://127.0.0.1:45231/callback"],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          ...extra,
        }),
      }),
    );
  const response = await register();
  expect(response.status).toBe(200);
  const client = await response.json();
  expect(client).toMatchObject({
    token_endpoint_auth_method: "none",
    redirect_uris: ["http://127.0.0.1:45231/callback"],
  });
  expect(client.client_id).toBeTruthy();
  expect(client.client_secret).toBeUndefined();
  expect(client.scope.split(" ")).toEqual(
    expect.arrayContaining(["testimonials:import", "offline_access"]),
  );
  expect((await register({ require_pkce: false })).status).toBe(400);
  for (const redirect of [
    "https://user:password@client.example/callback",
    "https://client.example/callback#fragment",
    "http://client.example/callback",
    "javascript:alert(1)",
  ]) {
    expect((await register({ redirect_uris: [redirect] })).status).toBe(400);
  }
  expect(
    await (await register({ skip_consent: true })).json(),
  ).not.toMatchObject({ skip_consent: true });
  const untrusted = await register({
    client_uri: "https://client.example",
    jwks_uri: "https://keys.example/keys",
  });
  expect(untrusted.status, await untrusted.clone().text()).toBe(200);
  const untrustedClient = await untrusted.json();
  expect(untrustedClient.skip_consent).not.toBe(true);
  expect(untrustedClient.client_uri).toBeUndefined();
  expect(untrustedClient.jwks_uri).toBeUndefined();
  expect((await register({ scope: "admin" })).status).toBe(400);
  expect((await register({ grant_types: ["client_credentials"] })).status).toBe(
    400,
  );
});
