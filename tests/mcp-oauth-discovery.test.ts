import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createConvexTest } from "./convex-test-helpers";
import { GET as protectedResource } from "../src/app/.well-known/oauth-protected-resource/mcp/route";
import { checkMcpOAuth } from "../scripts/check-mcp-oauth.mjs";

const origin = "https://www.getsomeproof.com";
beforeEach(() => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  vi.stubEnv("SITE_URL", origin);
  vi.stubEnv("BETTER_AUTH_SECRET", "oauth-discovery-synthetic-test-secret");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://fixture.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://fixture.convex.site");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("follows actual Next.js discovery and proxy handlers to Convex public registration", async () => {
  const t = createConvexTest();
  const { GET: metadata } =
    await import("../src/app/.well-known/oauth-authorization-server/api/import-auth/route");
  const { POST: register } =
    await import("../src/app/api/import-auth/[...all]/route");
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    paths.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
    if (url.origin === "https://fixture.convex.site")
      return t.fetch(url.pathname, init);
    expect(url.origin).toBe(origin);
    if (url.pathname === "/mcp") return new Response(null, { status: 405 });
    if (url.pathname === "/.well-known/oauth-protected-resource/mcp")
      return protectedResource();
    const request = new Request(url, init);
    if (
      url.pathname === "/.well-known/oauth-authorization-server/api/import-auth"
    )
      return metadata(request);
    if (url.pathname === "/api/import-auth/oauth2/register")
      return register(request);
    return new Response("Not found", { status: 404 });
  });
  await checkMcpOAuth(`${origin}/mcp`, { register: true, log: () => {} });
  expect(paths).toContain(
    "POST https://fixture.convex.site/api/import-auth/oauth2/register",
  );
  expect(paths).not.toContain(`POST ${origin}/register`);
});

it("fails on the production symptom when the web rollout flag is absent", async () => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "");
  vi.stubGlobal("fetch", async (input: string | URL) =>
    new URL(input).pathname === "/mcp"
      ? new Response(null, { status: 405 })
      : protectedResource(),
  );
  await expect(
    checkMcpOAuth(`${origin}/mcp`, { log: () => {} }),
  ).rejects.toThrow("Next.js CHATGPT_IMPORT_ENABLED=true");
});

it("fails instead of following the apex cross-origin redirect", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(null, {
        status: 308,
        headers: { location: `${origin}/mcp` },
      }),
  );
  await expect(
    checkMcpOAuth("https://getsomeproof.com/mcp", { log: () => {} }),
  ).rejects.toThrow("canonical origin");
});
