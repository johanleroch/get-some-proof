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
