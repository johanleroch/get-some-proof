// @vitest-environment node
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { memoryAdapter } from "better-auth/adapters/memory";
import { expect, it } from "vitest";
import {
  createImportOAuthOptions,
  importOAuthBasePath,
  importOAuthScope,
} from "./importOAuthOptions";

import { verifyImportAccessToken } from "./domain/importAccessToken";

const origin = "https://proof.example";
const callback = "https://client.example/oauth/callback";

it.each([
  "valid",
  "wrong verifier",
  "wrong resource",
  "wrong redirect",
  "missing challenge",
  "plain challenge",
])("enforces the consented import grant: %s", async (scenario) => {
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
  const cookie = signup.headers
    .getSetCookie()
    .map((part) => part.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie, origin });
  const client = await auth.api.createOAuthClient({
    headers,
    body: {
      client_name: "Import integration test",
      redirect_uris: [callback],
      scope: importOAuthScope,
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
    scope: importOAuthScope,
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
  const tokenResponse = await exchange(
    scenario === "wrong verifier" ? `${verifier}-incorrect` : verifier,
  );
  if (scenario !== "valid") {
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
    scope: importOAuthScope,
  });
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
