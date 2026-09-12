import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("GOOGLE_BUSINESS_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_BUSINESS_CLIENT_SECRET", "test-secret");
  vi.stubEnv(
    "GOOGLE_BUSINESS_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  );
  vi.stubEnv(
    "GOOGLE_BUSINESS_REDIRECT_URI",
    "http://localhost:3000/api/google-business/callback",
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("binds Google authorization to its Project Owner and consumes the state once", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const other = await authenticatedUser(t, { email: "other@example.com" });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const args = { organizationId: project.id };
  await expect(
    other.client.action(api.googleBusinessActions.connect, args),
  ).rejects.toThrow();
  const url = new URL(
    await owner.client.action(api.googleBusinessActions.connect, args),
  );
  expect(url.origin).toBe("https://accounts.google.com");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  const state = url.searchParams.get("state")!;
  const fetcher = vi.fn(async () =>
    Response.json({
      access_token: "access",
      refresh_token: "private-refresh",
      scope: "https://www.googleapis.com/auth/business.manage",
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    other.client.action(api.googleBusinessActions.complete, {
      state,
      code: "code",
    }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await owner.client.action(api.googleBusinessActions.complete, {
      state,
      code: "code",
    }),
  ).toBe(project.slug);
  const status = await owner.client.query(api.googleBusiness.status, args);
  expect(status.connected).toBe(true);
  expect(JSON.stringify(status)).not.toContain("private-refresh");
  await expect(
    owner.client.action(api.googleBusinessActions.complete, {
      state,
      code: "code",
    }),
  ).rejects.toThrow();
});

it("reads original reviews with pagination, refuses other Owners and forgets credentials on disconnect", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const other = await authenticatedUser(t, { email: "outsider@example.com" });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const args = { organizationId: project.id };
  const state = new URL(
    await owner.client.action(api.googleBusinessActions.connect, args),
  ).searchParams.get("state")!;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("/token"))
      return Response.json({
        access_token: "access",
        refresh_token: "secret-refresh",
        scope: "https://www.googleapis.com/auth/business.manage",
      });
    if (url.endsWith("/revoke")) return new Response(null, { status: 200 });
    return Response.json({
      reviews: [
        {
          reviewId: "review-1",
          reviewer: { displayName: "Camille Roche" },
          comment: "Lovely class.\nExactly as promised!",
          starRating: "FIVE",
        },
      ],
      nextPageToken: "next-page",
      totalReviewCount: 51,
      averageRating: 4.8,
    });
  });
  vi.stubGlobal("fetch", fetcher);
  await owner.client.action(api.googleBusinessActions.complete, {
    state,
    code: "code",
  });
  const request = {
    ...args,
    account: "accounts/123",
    location: "locations/456",
    pageToken: "second-page",
  };
  await expect(
    other.client.action(api.googleBusinessActions.read, request),
  ).rejects.toThrow();
  await expect(
    other.client.action(api.googleBusinessActions.disconnect, args),
  ).rejects.toThrow();
  const page = await owner.client.action(
    api.googleBusinessActions.read,
    request,
  );
  expect(page).toMatchObject({
    items: [
      {
        title: "Camille Roche",
        comment: "Lovely class.\nExactly as promised!",
        rating: "FIVE",
      },
    ],
    nextPageToken: "next-page",
    totalReviewCount: 51,
    averageRating: 4.8,
  });
  expect(
    fetcher.mock.calls.some(([url]) => url.includes("pageToken=second-page")),
  ).toBe(true);
  expect(
    await owner.client.action(api.googleBusinessActions.disconnect, args),
  ).toEqual({ revoked: true });
  expect(
    await owner.client.query(api.googleBusiness.status, args),
  ).toMatchObject({ connected: false });
  await expect(
    owner.client.action(api.googleBusinessActions.read, request),
  ).rejects.toThrow();
});

it("rejects expired OAuth state before calling Google", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  const state = new URL(
    await owner.client.action(api.googleBusinessActions.connect, {
      organizationId: project.id,
    }),
  ).searchParams.get("state")!;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60_000);
  try {
    await expect(
      owner.client.action(api.googleBusinessActions.complete, {
        state,
        code: "code",
      }),
    ).rejects.toThrow();
  } finally {
    clock.mockRestore();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
