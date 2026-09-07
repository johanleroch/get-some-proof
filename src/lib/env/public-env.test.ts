import { describe, expect, it } from "vitest";

import { readPublicEnvironment } from "@/lib/env/public-env";

describe("public application environment", () => {
  it("accepts a configured Convex deployment URL", () => {
    expect(
      readPublicEnvironment({
        NEXT_PUBLIC_CONVEX_URL: "https://careful-otter-123.convex.cloud",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://careful-otter-123.convex.site",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toEqual({
      configured: true,
      convexUrl: "https://careful-otter-123.convex.cloud",
      convexSiteUrl: "https://careful-otter-123.convex.site",
      siteUrl: "http://localhost:3000",
    });
  });

  it("accepts an anonymous local Convex backend on a loopback host", () => {
    expect(
      readPublicEnvironment({
        NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
        NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3211",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toEqual({
      configured: true,
      convexUrl: "http://127.0.0.1:3210",
      convexSiteUrl: "http://127.0.0.1:3211",
      siteUrl: "http://localhost:3000",
    });
  });

  it("rejects plain-HTTP Convex URLs that are not on a loopback host", () => {
    expect(
      readPublicEnvironment({
        NEXT_PUBLIC_CONVEX_URL: "http://careful-otter-123.convex.cloud",
        NEXT_PUBLIC_CONVEX_SITE_URL: "http://192.168.1.20:3211",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toEqual({
      configured: false,
      missing: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CONVEX_SITE_URL"],
    });
  });

  it("returns actionable missing-variable diagnostics", () => {
    expect(readPublicEnvironment({})).toEqual({
      configured: false,
      missing: [
        "NEXT_PUBLIC_CONVEX_URL",
        "NEXT_PUBLIC_CONVEX_SITE_URL",
        "NEXT_PUBLIC_SITE_URL",
      ],
    });
  });
});
