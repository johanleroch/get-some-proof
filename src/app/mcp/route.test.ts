import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3290");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3897");
});
afterEach(() => vi.unstubAllEnvs());

it("keeps the smaller budget for other tools and caps photo requests", async () => {
  for (const [name, imageBase64] of [
    ["correct_testimonial_identity", "A".repeat(17_000)],
    ["set_testimonial_photo", "A".repeat(1_004_097)],
  ]) {
    const response = await POST(
      new Request("http://127.0.0.1:3897/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: { imageBase64 } },
        }),
      }),
    );
    expect(response.status).toBe(413);
  }
});

it("is disabled unless deliberately enabled", async () => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "false");
  expect(
    (
      await POST(
        new Request("http://127.0.0.1:3897/mcp", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
  ).toBe(503);
});

it("rejects oversize bodies and untrusted browser origins before tool execution", async () => {
  expect(
    (
      await POST(
        new Request("http://127.0.0.1:3897/mcp", {
          method: "POST",
          body: "x".repeat(16385),
        }),
      )
    ).status,
  ).toBe(413);
  const response = await POST(
    new Request("http://127.0.0.1:3897/mcp", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3897",
        origin: "https://untrusted.example",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    }),
  );
  expect(response.status).toBe(403);
});
