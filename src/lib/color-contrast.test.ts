import { describe, expect, it } from "vitest";

import { accentInk, contrastRatio } from "@/lib/color-contrast";

describe("accent contrast", () => {
  it("puts dark ink on amber and light accents", () => {
    expect(accentInk("#FFBB16")).toBe("#2e2a25");
    expect(accentInk("#fde68a")).toBe("#2e2a25");
    expect(accentInk("#ffffff")).toBe("#2e2a25");
  });

  it("puts white on deep accents", () => {
    expect(accentInk("#6d5dfc")).toBe("#ffffff");
    expect(accentInk("#1d4ed8")).toBe("#ffffff");
    expect(accentInk("#111")).toBe("#ffffff");
  });

  it("falls back to dark ink on invalid input and measures ratios", () => {
    expect(accentInk("not a color")).toBe("#2e2a25");
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("nope", "#ffffff")).toBeNull();
  });
});
