// @vitest-environment node
import { expect, test, vi } from "vitest";
import { deliveryResponse } from "./worker";
import { prepareDeliveryPublication } from "../../src/lib/cloudflare-delivery";
const publicId = "12345678-1234-4234-8234-123456789abc";
const origin = "https://staging.cedar.example";
const publication = () =>
  prepareDeliveryPublication(
    {
      config: {
        layout: "masonry",
        font: "inherit",
        accentColor: "#ffbb16",
        backgroundColor: "#ffffff",
        textColor: "#2e2a25",
      },
      brandName: "Cedar Workshop",
      attributionRequired: true,
      testimonials: [],
    },
    {
      publicId,
      revision: 1,
      policyRevision: 1,
      generatedAt: Date.now(),
      validUntil: Date.now() + 3600000,
      allowedOrigins: [origin],
    },
  );

test("serves a complete valid Widget from KV on both cold and warm reads", async () => {
  const kv = { get: vi.fn(async () => JSON.stringify(publication())) };
  for (let i = 0; i < 2; i++) {
    const response = await deliveryResponse(
      new Request(`https://delivery.example/api/widgets/${publicId}`, {
        headers: { Origin: origin },
      }),
      kv,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).brand.name).toBe("Cedar Workshop");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
});

test("denies invalid identifiers, query strings and absent origins before KV, with no origin fallback", async () => {
  const get = vi.fn(async () => null);
  const fallback = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Forbidden application call"));
  for (const [path, caller] of [
    ["/api/widgets/invalid", origin],
    [`/api/widgets/${publicId}?cursor=anything`, origin],
    [`/api/widgets/${publicId}`, ""],
    ["/api/public-wall/cedar", origin],
  ]) {
    const response = await deliveryResponse(
      new Request(`https://delivery.example${path}`, {
        headers: { Origin: caller },
      }),
      { get },
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("Location")).toBeNull();
  }
  expect(get).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  fallback.mockRestore();
});

test("fails closed for missing, expired, future, unsupported and failed KV reads", async () => {
  const good = publication();
  for (const record of [
    null,
    "invalid json",
    JSON.stringify({ ...good, validUntil: Date.now() - 1 }),
    JSON.stringify({ ...good, generatedAt: Date.now() + 60000 }),
    JSON.stringify({ ...good, schemaVersion: 2 }),
    JSON.stringify({
      ...good,
      publicId: "87654321-1234-4234-8234-123456789abc",
    }),
  ]) {
    const response = await deliveryResponse(
      new Request(`https://delivery.example/api/widgets/${publicId}`, {
        headers: { Origin: origin },
      }),
      { get: async () => record },
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  const failed = await deliveryResponse(
    new Request(`https://delivery.example/api/widgets/${publicId}`, {
      headers: { Origin: origin },
    }),
    {
      get: async () => {
        throw new Error("Provider failure");
      },
    },
  );
  expect(failed.status).toBe(503);
});

test("does not expose a publication to another origin on a warm KV read", async () => {
  const record = JSON.stringify(publication());
  const kv = { get: async () => record };
  for (const caller of [
    origin,
    "https://unlisted.example",
    "https://staging.cedar.example:444",
    "null",
    origin,
  ]) {
    const response = await deliveryResponse(
      new Request(`https://delivery.example/api/widgets/${publicId}`, {
        headers: { Origin: caller },
      }),
      kv,
    );
    expect(response.status).toBe(caller === origin ? 200 : 403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      caller === origin ? origin : null,
    );
    if (caller === origin) expect(response.headers.get("Vary")).toBe("Origin");
  }
});

test("rejects malformed or unbounded provider payloads instead of returning browser data", async () => {
  for (const record of [
    JSON.stringify({ ...publication(), payload: { schemaVersion: 1 } }),
    "x".repeat(1000001),
  ]) {
    const response = await deliveryResponse(
      new Request(`https://delivery.example/api/widgets/${publicId}`, {
        headers: { Origin: origin },
      }),
      { get: async () => record },
    );
    expect(response.status).toBe(503);
  }
});
