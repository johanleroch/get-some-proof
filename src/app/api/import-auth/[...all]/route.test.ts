// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({
  handler: { GET: mocks.get, POST: mocks.post },
}));
import { GET } from "./route";
beforeEach(() => mocks.get.mockReset());
afterEach(() => vi.unstubAllEnvs());

it("uses the configured local site origin when Next normalizes the request host", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3897");
  mocks.get.mockResolvedValue(
    new Response(
      JSON.stringify({
        redirect: true,
        url: "http://127.0.0.1:3897/import/authorize",
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  const response = await GET(
    new Request("http://localhost:3897/api/import-auth/oauth2/authorize", {
      headers: { accept: "text/html" },
    }),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:3897/import/authorize",
  );
});

it("restores browser redirects and keeps response cookies", async () => {
  mocks.get.mockResolvedValue(
    new Response(
      JSON.stringify({
        redirect: true,
        url: "https://proof.example/import/authorize?state=fixture",
      }),
      {
        headers: {
          "content-type": "application/json",
          "set-cookie": "fixture=opaque; HttpOnly; Secure",
          "cache-control": "no-store",
        },
      },
    ),
  );
  const response = await GET(
    new Request("https://proof.example/api/import-auth/oauth2/authorize", {
      headers: { accept: "text/html" },
    }),
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    "https://proof.example/import/authorize?state=fixture",
  );
  expect(response.headers.get("set-cookie")).toContain("fixture=opaque");
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("preserves fetch clients and never navigates to an executable URL", async () => {
  const json = new Response(
    JSON.stringify({
      redirect: true,
      url: "https://proof.example/import/authorize",
    }),
    { headers: { "content-type": "application/json" } },
  );
  mocks.get.mockResolvedValueOnce(json);
  expect(
    await GET(
      new Request("https://proof.example/api/import-auth/oauth2/authorize", {
        headers: { accept: "application/json" },
      }),
    ),
  ).toBe(json);
  mocks.get.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ redirect: true, url: "javascript:alert(1)" }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  expect(
    (
      await GET(
        new Request("https://proof.example/api/import-auth/oauth2/authorize", {
          headers: { accept: "text/html" },
        }),
      )
    ).status,
  ).toBe(502);
});
