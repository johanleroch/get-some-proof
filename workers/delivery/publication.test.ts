// @vitest-environment node
import { expect, test, vi } from "vitest";
import { publicationResponse } from "./publication";
import { prepareDeliveryPublication } from "../../src/lib/cloudflare-delivery";
const id = "12345678-1234-4234-8234-123456789abc";
const origin = "http://127.0.0.1:8790";
const secret = "synthetic-test-secret-32-characters-long";
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
      publicId: id,
      revision: 1,
      policyRevision: 1,
      generatedAt: Date.now(),
      validUntil: Date.now() + 3600000,
      allowedOrigins: [origin],
    },
  );

test("accepts an authenticated bounded publication and stores its absolute expiry", async () => {
  const put = vi.fn(async () => {});
  const envelope = publication();
  const response = await publicationResponse(
    new Request(`https://canary.example/__publish/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify(envelope),
    }),
    { put },
    secret,
    [origin],
  );
  expect(response.status).toBe(201);
  expect(put).toHaveBeenCalledWith(`widget:${id}`, JSON.stringify(envelope), {
    expiration: Math.ceil(envelope.validUntil / 1000),
  });
});

test("denies unauthenticated, mismatched and non-staging-origin publications before storage", async () => {
  const put = vi.fn(async () => {});
  for (const [token, body] of [
    ["wrong", publication()],
    [
      secret,
      { ...publication(), publicId: "87654321-1234-4234-8234-123456789abc" },
    ],
    [
      secret,
      { ...publication(), allowedOrigins: ["https://production.example"] },
    ],
  ] as const) {
    const response = await publicationResponse(
      new Request(`https://canary.example/__publish/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }),
      { put },
      secret,
      [origin],
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  expect(put).not.toHaveBeenCalled();
});

test("bounds streamed uploads and reports invalid, expired and failed writes without retry", async () => {
  const put = vi.fn(async () => {});
  for (const body of [
    "x".repeat(1000001),
    "invalid",
    JSON.stringify({ ...publication(), validUntil: 1 }),
    JSON.stringify({ ...publication(), generatedAt: Date.now() + 60000 }),
  ]) {
    const response = await publicationResponse(
      new Request(`https://canary.example/__publish/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${secret}` },
        body,
      }),
      { put },
      secret,
      [origin],
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  expect(put).not.toHaveBeenCalled();
  const failed = await publicationResponse(
    new Request(`https://canary.example/__publish/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify(publication()),
    }),
    {
      put: async () => {
        throw new Error("Unknown result");
      },
    },
    secret,
    [origin],
  );
  expect(failed.status).toBe(503);
});
