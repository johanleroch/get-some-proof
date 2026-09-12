import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

/** Public HTTP checks only. Registration is opt-in and creates one OAuth client. */
export async function checkMcpOAuth(
  endpoint,
  { register = false, log = console.log } = {},
) {
  const resource = new URL(endpoint);
  assert(
    ["http:", "https:"].includes(resource.protocol),
    "Use an HTTP(S) MCP URL",
  );
  assert(
    !resource.username &&
      !resource.password &&
      !resource.search &&
      !resource.hash,
    "Use a credential-free MCP URL without query or fragment",
  );
  async function request(url, init) {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    log(`${init?.method ?? "GET"} ${url} -> ${response.status}`);
    assert(
      response.status < 300 || response.status >= 400,
      `OAuth redirect rejected; configure the canonical origin (${response.headers.get("location")})`,
    );
    return response;
  }
  const probe = await request(resource.href);
  assert([200, 401, 405].includes(probe.status), "MCP endpoint unavailable");
  const protectedUrl = new URL(
    `/.well-known/oauth-protected-resource${resource.pathname}`,
    resource,
  );
  const protectedResponse = await request(protectedUrl.href);
  assert.equal(
    protectedResponse.status,
    200,
    "Protected-resource discovery unavailable; check Next.js CHATGPT_IMPORT_ENABLED=true and NEXT_PUBLIC_SITE_URL",
  );
  const protectedMetadata = await protectedResponse.json();
  assert.equal(
    protectedMetadata.resource,
    resource.href,
    "Resource must match the canonical MCP URL",
  );
  assert(
    protectedMetadata.scopes_supported?.includes(
      "testimonials:import:assistant",
    ),
    "Assistant scope missing",
  );
  const issuer = new URL(protectedMetadata.authorization_servers?.[0]);
  assert.equal(
    issuer.origin,
    resource.origin,
    "Issuer must use the configured canonical origin",
  );
  const metadataUrl = new URL(
    `/.well-known/oauth-authorization-server${issuer.pathname}`,
    issuer,
  );
  const metadataResponse = await request(metadataUrl.href);
  assert.equal(
    metadataResponse.status,
    200,
    "Issuer discovery unavailable; check matching Convex CHATGPT_IMPORT_ENABLED=true and the Next.js auth proxy",
  );
  const metadata = await metadataResponse.json();
  assert.equal(
    metadata.issuer,
    issuer.href,
    "Issuer mismatch; align Convex SITE_URL and Next.js NEXT_PUBLIC_SITE_URL",
  );
  for (const field of [
    "authorization_endpoint",
    "token_endpoint",
    "registration_endpoint",
  ]) {
    const url = new URL(metadata[field]);
    assert.equal(
      url.origin,
      resource.origin,
      `${field} uses a different origin`,
    );
    log(`${field}: ${url.href}`);
  }
  for (const scope of ["testimonials:import:assistant", "offline_access"])
    assert(
      metadata.scopes_supported?.includes(scope),
      `Missing OAuth scope: ${scope}`,
    );
  assert(
    metadata.code_challenge_methods_supported?.includes("S256"),
    "PKCE S256 missing",
  );
  assert(
    metadata.token_endpoint_auth_methods_supported?.includes("none"),
    "Public client auth missing",
  );
  if (register) {
    const response = await request(metadata.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "MCP connection diagnostic",
        redirect_uris: ["http://127.0.0.1:45231/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "testimonials:import:assistant offline_access",
      }),
    });
    assert.equal(
      response.status,
      201,
      "Dynamic registration must return JSON 201 at the advertised URL",
    );
    const client = await response.json();
    assert(
      client.client_id && !client.client_secret,
      "Expected a public OAuth client",
    );
    log("Dynamic registration passed (client identifier omitted)");
  }
  log(
    "Discovery checks passed. User consent, token exchange and a real Codex session remain unverified.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkMcpOAuth(process.argv[2] ?? "https://www.getsomeproof.com/mcp", {
      register: process.argv.includes("--register"),
    });
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
