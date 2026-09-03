import { describe, expect, it } from "vitest";

import { buildPublicWallMetadata } from "./public-wall-metadata";

describe("buildPublicWallMetadata", () => {
  it("indexes a nonempty wall with a self-canonical URL", () => {
    const metadata = buildPublicWallMetadata(
      {
        brandName: "Acme Studio",
        publicSlug: "acme-proof",
        testimonialCount: 2,
      },
      "https://example.com",
    );

    expect(metadata.alternates).toEqual({
      canonical: "https://example.com/w/acme-proof",
    });
    expect(metadata.robots).toEqual({ follow: true, index: true });
  });

  it("keeps an empty wall out of search indexes", () => {
    const metadata = buildPublicWallMetadata(
      {
        brandName: "Acme Studio",
        publicSlug: "acme-proof",
        testimonialCount: 0,
      },
      "https://example.com",
    );

    expect(metadata.robots).toEqual({ follow: false, index: false });
  });
});
