import { describe, expect, it } from "vitest";

import { sourcePlatforms, testimonialSource } from "./testimonialSource";

describe("testimonialSource", () => {
  it("names the platform from the link a review was copied from", () => {
    expect(
      testimonialSource(undefined, "https://www.trustpilot.com/reviews/abc123"),
    ).toEqual({
      platform: "trustpilot",
      url: "https://www.trustpilot.com/reviews/abc123",
    });
    expect(
      testimonialSource(undefined, "https://fr.trustpilot.com/review/site.fr"),
    ).toEqual({
      platform: "trustpilot",
      url: "https://fr.trustpilot.com/review/site.fr",
    });
    expect(testimonialSource(undefined, "https://example.com/review")).toBe(
      undefined,
    );
  });

  it("keeps the platform it was told, and the link only when the two agree", () => {
    expect(testimonialSource("trustpilot")).toEqual({ platform: "trustpilot" });
    expect(testimonialSource("twitter", "https://x.com/a/status/1")).toEqual({
      platform: "x",
      url: "https://x.com/a/status/1",
    });
    // A link elsewhere must never make the badge point at another platform.
    expect(
      testimonialSource("trustpilot", "https://www.google.com/maps/reviews/1"),
    ).toEqual({ platform: "trustpilot" });
    expect(testimonialSource("trustpilot", "javascript:alert(1)")).toEqual({
      platform: "trustpilot",
    });
  });

  it("answers for every platform it accepts", () => {
    for (const platform of sourcePlatforms) {
      expect(testimonialSource(platform)).toEqual({ platform });
    }
  });
});
