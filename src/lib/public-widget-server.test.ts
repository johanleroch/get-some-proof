import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const { fetchQuery, fetchMutation } = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  fetchMutation: vi.fn(),
}));
vi.mock("convex/nextjs", () => ({ fetchQuery, fetchMutation }));
import { publicWidgetResponse } from "./public-widget-server";
const publicId = "11111111-1111-4111-8111-111111111111";
const request = () =>
  new Request(`https://proof.example/api/widgets/${publicId}`);
const context = { params: Promise.resolve({ publicId }) };
const payload = {
  publicId,
  brandName: "Acme",
  publicSlug: "acme-proof",
  config: {
    layout: "wall",
    font: "inherit",
    accentColor: "#123abc",
    backgroundColor: "#ffffff",
    textColor: "#222222",
  },
  testimonials: [],
  attributionRequired: true,
  privacyRevision: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PUBLIC_WALL_ORIGIN_GATEWAY_SECRET", undefined);
  vi.stubEnv(
    "PUBLIC_READ_RATE_LIMIT_SECRET",
    "test-rate-limit-secret-at-least-32-chars",
  );
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://proof.example");
  fetchMutation.mockResolvedValue({ remaining: 1, resetAt: 60000 });
  fetchQuery
    .mockResolvedValueOnce({ publicSlug: "acme-proof" })
    .mockResolvedValueOnce(payload);
});
afterEach(() => vi.unstubAllEnvs());
describe("public widget admission", () => {
  it("admits both lookup and brand reads before hydrating any testimonial", async () => {
    const events: string[] = [];
    fetchMutation.mockImplementation(async (_ref, args) => {
      events.push(args.publicSlug ? "admit-read" : "admit-lookup");
      return {};
    });
    fetchQuery
      .mockReset()
      .mockImplementationOnce(async () => {
        events.push("lookup");
        return { publicSlug: "acme-proof" };
      })
      .mockImplementationOnce(async () => {
        events.push("hydrate");
        return payload;
      });
    const response = await publicWidgetResponse(request(), context);
    expect(response.status).toBe(200);
    expect(events).toEqual(["admit-lookup", "lookup", "admit-read", "hydrate"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMutation.mock.calls[1][1]).toMatchObject({
      publicSlug: "acme-proof",
      requesterKey: fetchMutation.mock.calls[0][1].requesterKey,
    });
  });
  it("does not hydrate when the project read budget is exhausted", async () => {
    fetchMutation
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("PUBLIC_READ_RATE_LIMITED"));
    const response = await publicWidgetResponse(request(), context);
    expect(response.status).toBe(429);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
  });
  it("does not allocate a project read bucket for a missing widget", async () => {
    fetchQuery.mockReset().mockResolvedValue(null);
    expect((await publicWidgetResponse(request(), context)).status).toBe(404);
    expect(fetchMutation).toHaveBeenCalledTimes(1);
  });
  it("fails closed when unpublished between lookup and hydration", async () => {
    fetchQuery
      .mockReset()
      .mockResolvedValueOnce({ publicSlug: "acme-proof" })
      .mockResolvedValueOnce(null);
    expect((await publicWidgetResponse(request(), context)).status).toBe(404);
  });
  it("rejects gateway bypass and unsupported query parameters before reads", async () => {
    expect(
      (
        await publicWidgetResponse(
          new Request(`${request().url}?draft=true`),
          context,
        )
      ).status,
    ).toBe(400);
    vi.stubEnv(
      "PUBLIC_WALL_ORIGIN_GATEWAY_SECRET",
      "gateway-service-test-credential-32-characters",
    );
    expect((await publicWidgetResponse(request(), context)).status).toBe(403);
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(fetchMutation).not.toHaveBeenCalled();
  });
});
