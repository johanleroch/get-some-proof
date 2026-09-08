import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      accentInk: "#ffffff",
      attributionRequired: true,
      brandName: "Acme Studio",
      hasPublishedTestimonials: true,
      privacyRevision: 0,
      publicSlug: "acme-proof",
      theme: "system",
      transparentEmbed: false,
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
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL", "");
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
    const body = await response.json();
    expect(body).toEqual({
      brand: {
        accentColor: "#123abc",
        accentInk: "#ffffff",
        attributionRequired: true,
        name: "Acme Studio",
        publicSlug: "acme-proof",
        theme: "system",
        transparentEmbed: false,
      },
      pagination: { cursor: expect.any(String) },
      schemaVersion: 1,
      privacyRevision: 0,
      testimonials: [
        {
          avatarUrl: null,
          html: expect.stringContaining('data-gsp-card=""'),
          id: "projection-1",
          name: "Camille Test",
          publishedAt: 1,
          text: "A public-safe customer outcome.",
          type: "text",
        },
      ],
    });
    expect(fetchMutation).toHaveBeenCalledTimes(2);
    expect(response.headers.has("x-ratelimit-remaining")).toBe(false);
    expect(response.headers.has("x-ratelimit-reset")).toBe(false);
    expect(JSON.stringify(body)).not.toContain(
      process.env.PUBLIC_READ_RATE_LIMIT_SECRET,
    );
    expect(JSON.stringify(body)).not.toContain("Powered by Get Some Proof");
  });

  it("returns the same public-safe video projection without private identity", async () => {
    fetchQuery
      .mockReset()
      .mockResolvedValueOnce({
        accentColor: "#123abc",
        accentInk: "#ffffff",
        attributionRequired: false,
        brandName: "Acme Studio",
        hasPublishedTestimonials: true,
        privacyRevision: 0,
        publicSlug: "acme-proof",
        theme: "dark",
        transparentEmbed: true,
      })
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [
          {
            aspectRatio: "3:4",
            avatarUrl: null,
            captionsAvailable: true,
            id: "video-projection",
            name: "Camille Test",
            playbackId: "public-playback-id",
            publishedAt: 2,
            type: "video",
          },
        ],
      });

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );
    const body = await response.json();

    expect(body.testimonials).toEqual([
      {
        aspectRatio: "3:4",
        avatarUrl: null,
        captionsAvailable: true,
        html: expect.stringContaining('data-gsp-play=""'),
        id: "video-projection",
        name: "Camille Test",
        playbackId: "public-playback-id",
        publishedAt: 2,
        type: "video",
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("submitterEmail");
    expect(JSON.stringify(body)).not.toContain("viewer");
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

  it("returns a new ETag with no testimonial after immediate consent withdrawal", async () => {
    const first = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof"),
      context,
    );
    const priorEtag = first.headers.get("etag");
    fetchQuery
      .mockResolvedValueOnce({
        accentColor: "#123abc",
        accentInk: "#ffffff",
        attributionRequired: true,
        brandName: "Acme Studio",
        hasPublishedTestimonials: false,
        publicSlug: "acme-proof",
        theme: "system",
        transparentEmbed: false,
      })
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [],
      });

    const response = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof", {
        headers: { "If-None-Match": priorEtag! },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).not.toBe(priorEtag);
    await expect(response.json()).resolves.toMatchObject({ testimonials: [] });
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
      secret: "test-rate-limit-secret-at-least-32-chars",
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

  it("requires the configured gateway credential on every origin hostname", async () => {
    vi.stubEnv(
      "PUBLIC_WALL_ORIGIN_GATEWAY_SECRET",
      "gateway-service-test-credential-32-characters",
    );
    for (const hostname of [
      "proof.example",
      "preview.example",
      "alternate.example",
    ]) {
      const result = await GET(
        new Request(`https://${hostname}/api/public-wall/acme-proof`, {
          headers: {
            "x-gsp-origin-secret": "forged",
            "cf-connecting-ip": "203.0.113.20",
          },
        }),
        context,
      );
      expect(result.status).toBe(403);
      expect(result.headers.get("cache-control")).toBe("no-store");
    }
    expect(fetchMutation).not.toHaveBeenCalled();
    expect(fetchQuery).not.toHaveBeenCalled();
    const result = await GET(
      new Request("https://proof.example/api/public-wall/acme-proof", {
        headers: {
          "x-gsp-origin-secret": process.env.PUBLIC_WALL_ORIGIN_GATEWAY_SECRET!,
        },
      }),
      context,
    );
    expect(result.status).toBe(200);
    expect(await result.text()).not.toContain(
      process.env.PUBLIC_WALL_ORIGIN_GATEWAY_SECRET,
    );
  });

  it("ignores client-controlled forwarded headers outside managed ingress", async () => {
    vi.useFakeTimers();
    try {
      for (const ip of ["203.0.113.10", "203.0.113.11"]) {
        await GET(
          new Request("https://proof.example/api/public-wall/acme-proof", {
            headers: {
              "x-vercel-forwarded-for": ip,
              "x-forwarded-for": ip,
              "cf-connecting-ip": ip,
            },
          }),
          context,
        );
        mockProjection();
      }
      expect(fetchMutation.mock.calls[0][1].requesterKey).toBe(
        fetchMutation.mock.calls[2][1].requesterKey,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("isolates requester keys without storing a public IP", async () => {
    vi.stubEnv("VERCEL", "1");
    const firstRequest = new Request(
      "https://proof.example/api/public-wall/acme-proof",
      { headers: { "x-forwarded-for": "203.0.113.10" } },
    );
    await GET(firstRequest, context);
    mockProjection();
    const secondRequest = new Request(
      "https://proof.example/api/public-wall/acme-proof",
      { headers: { "x-forwarded-for": "203.0.113.11" } },
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
