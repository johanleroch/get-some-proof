import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());
it("advertises only the configured import resource and respects the rollout flag", async () => {
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "false");
  expect(GET().status).toBe(404);
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  expect(GET().status).toBe(503);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://proof.example");
  const response = GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    resource: "https://proof.example/mcp",
    authorization_servers: ["https://proof.example/api/import-auth"],
    scopes_supported: ["testimonials:import"],
    bearer_methods_supported: ["header"],
  });
});
