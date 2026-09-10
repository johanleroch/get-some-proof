import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { GET } from "./route";

it("serves an isolated no-store handoff document with only its exact inline script allowed", async () => {
  const response = GET();
  const body = await response.text();
  const script = body.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const hash = createHash("sha256").update(script).digest("base64");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("content-security-policy")).toBe(
    `default-src 'none'; script-src 'sha256-${hash}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  );
  expect(body).not.toMatch(/src=|fetch\(|XMLHttpRequest|sendBeacon/);
});
