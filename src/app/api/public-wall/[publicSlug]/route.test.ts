import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMutation, fetchQuery } = vi.hoisted(() => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({ fetchMutation, fetchQuery }));

import { GET } from "./route";

const context = {
  params: Promise.resolve({ publicSlug: "acme-proof" }),
};

function mockProjection() {
  fetchQuery
    .mockResolvedValueOnce({
      accentColor: "#123abc",
      attributionRequired: true,
      brandName: "Acme Studio",
      hasPublishedTestimonials: true,
      publicSlug: "acme-proof",
    })
    .mockResolvedValueOnce({
      continueCursor: "next-page",
      isDone: false,
      page: [
        {
          avatarUrl: null,
          id: "projection-1",
          name: "Camille Test",
          publishedAt: 1,
          text: "A public-safe customer outcome.",
          type: "text",
        },
      ],
    });
}

describe("GET /api/public-wall/:publicSlug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "PUBLIC_READ_RATE_LIMIT_SECRET",
      "test-rate-limit-secret-at-least-32-chars",
    );
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://proof.example");
    fetchMutation.mockResolvedValue({ remaining: 119, resetAt: 60_000 });
    mockProjection();
  });

  it("returns only the cacheable versioned Public Projection contract", async () => {
    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
    await expect(response.json()).resolves.toEqual({
      brand: {
        accentColor: "#123abc",
        attributionRequired: true,
        name: "Acme Studio",
        publicSlug: "acme-proof",
      },
      pagination: { cursor: expect.any(String) },
      schemaVersion: 1,
      testimonials: [
        {
          avatarUrl: null,
          id: "projection-1",
          name: "Camille Test",
          publishedAt: 1,
          text: "A public-safe customer outcome.",
          type: "text",
        },
      ],
    });
    expect(fetchMutation).toHaveBeenCalledTimes(2);
  });

  it("revalidates cached reads without replaying unchanged content", async () => {
    const first = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );
    const etag = first.headers.get("etag");
    mockProjection();

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof", {
        headers: { "If-None-Match": etag! },
      }),
      context,
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(etag);
    expect(await response.text()).toBe("");
  });

  it("accepts only a server-signed pagination cursor", async () => {
    const first = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );
    const firstPage = await first.json();
    const cursor = firstPage.pagination.cursor as string;
    fetchQuery.mockClear();
    mockProjection();

    const response = await GET(
      new Request(
        `https://proof.example/api/public-wall/acme-proof?cursor=${encodeURIComponent(cursor)}`,
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(fetchQuery).toHaveBeenNthCalledWith(2, expect.anything(), {
      paginationOpts: { cursor: "next-page", numItems: 50 },
      publicSlug: "acme-proof",
    });
  });

  it("rejects unsigned cursors and cache-busting parameters before reading", async () => {
    for (const url of [
      "https://proof.example/api/public-wall/acme-proof?cursor=forged",
      "https://proof.example/api/public-wall/acme-proof?cache-bust=1",
    ]) {
      const response = await GET(new Request(url), context);
      expect(response.status).toBe(400);
    }

    expect(fetchMutation).not.toHaveBeenCalled();
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  it("returns an explicit non-cacheable configuration failure", async () => {
    vi.stubEnv("PUBLIC_READ_RATE_LIMIT_SECRET", "");

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "EMBED_NOT_CONFIGURED",
    });
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  it("returns an explicit non-cacheable backend failure", async () => {
    fetchQuery.mockReset().mockRejectedValue(new Error("backend unavailable"));

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "PUBLIC_WALL_UNAVAILABLE",
    });
  });

  it("returns an explicit non-cacheable rate-limit response", async () => {
    fetchMutation.mockRejectedValue(new Error("PUBLIC_READ_RATE_LIMITED"));

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "PUBLIC_READ_RATE_LIMITED",
    });
    expect(fetchQuery).not.toHaveBeenCalled();
  });

  it("does not create a rate-limit bucket for an unknown Brand", async () => {
    fetchQuery.mockReset().mockResolvedValue(null);

    const response = await GET(
      new Request("https://proof.example/api/public-wall/missing-brand"),
      { params: Promise.resolve({ publicSlug: "missing-brand" }) },
    );

    expect(response.status).toBe(404);
    expect(fetchMutation).toHaveBeenCalledOnce();
    expect(fetchMutation.mock.calls[0]?.[1]).not.toHaveProperty("publicSlug");
  });

  it("isolates requester keys without storing a public IP", async () => {
    const firstRequest = new Request(
      "https://proof.example/api/public-wall/acme-proof",
      { headers: { "x-vercel-forwarded-for": "203.0.113.10" } },
    );
    await GET(firstRequest, context);
    mockProjection();
    const secondRequest = new Request(
      "https://proof.example/api/public-wall/acme-proof",
      { headers: { "x-vercel-forwarded-for": "203.0.113.11" } },
    );
    await GET(secondRequest, context);

    const firstArgs = fetchMutation.mock.calls[0]?.[1];
    const secondArgs = fetchMutation.mock.calls[2]?.[1];
    expect(firstArgs.requesterKey).toMatch(/^[a-f0-9]{32}$/);
    expect(secondArgs.requesterKey).toMatch(/^[a-f0-9]{32}$/);
    expect(firstArgs.requesterKey).not.toBe(secondArgs.requesterKey);
    expect(fetchMutation.mock.calls[1]?.[1]).toMatchObject({
      publicSlug: "acme-proof",
      requesterKey: firstArgs.requesterKey,
    });
    expect(fetchMutation.mock.calls[3]?.[1]).toMatchObject({
      publicSlug: "acme-proof",
      requesterKey: secondArgs.requesterKey,
    });
    expect(JSON.stringify(fetchMutation.mock.calls)).not.toContain("203.0.113");
  });
});
