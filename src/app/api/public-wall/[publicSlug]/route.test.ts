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
  });

  it("returns only the cacheable versioned Public Projection contract", async () => {
    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    await expect(response.json()).resolves.toEqual({
      brand: {
        accentColor: "#123abc",
        attributionRequired: true,
        name: "Acme Studio",
        publicSlug: "acme-proof",
      },
      pagination: { cursor: "next-page" },
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
    expect(fetchMutation).toHaveBeenCalledOnce();
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
});
