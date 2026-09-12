import { describe, expect, it } from "vitest";

import { sourcePlatforms } from "@convex/domain/testimonialSource";

import { sourceIconSvg, sourceIcons } from "./source-icons";

describe("source icons", () => {
  it("carries a mark for every platform a testimonial can come from", () => {
    for (const platform of sourcePlatforms) {
      const mark = sourceIcons[platform];
      expect(mark.label.length, platform).toBeGreaterThan(0);
      expect(mark.color, platform).toMatch(/^#[0-9a-f]{6}$/);
      expect(mark.fit, platform).toMatch(/^translate\(.+\) scale\(.+\)$/);
    }
  });

  it("draws every mark through its fit, on the grid and nowhere else", () => {
    for (const platform of sourcePlatforms) {
      const svg = sourceIconSvg(platform);
      expect(svg, platform).toContain('viewBox="0 0 24 24"');
      expect(svg, platform).toContain(
        `<g transform="${sourceIcons[platform].fit}">`,
      );
    }
    expect(sourceIconSvg("google", { chip: false, size: 56 })).toContain(
      'width="56"',
    );
    expect(sourceIconSvg("google", { chip: false })).not.toContain(
      "background:white",
    );
  });
});
