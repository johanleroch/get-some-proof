import { describe, expect, it } from "vitest";
import {
  normalizeRichText,
  richTextFromPlain,
  richTextToPlain,
} from "../convex/domain/testimonialRichText";

describe("Testimonial formatting", () => {
  it("preserves paragraphs and highlighted words without changing canonical content", () => {
    const content = [
      {
        type: "p" as const,
        children: [
          { text: "We saved " },
          { text: "five hours", highlight: true },
        ],
      },
      { type: "p" as const, children: [{ text: "every week." }] },
    ];
    expect(
      normalizeRichText(content, "We saved five hours\nevery week."),
    ).toEqual(content);
    expect(richTextToPlain(content)).toBe("We saved five hours\nevery week.");
    expect(richTextFromPlain("Before\nAfter")).toEqual([
      { type: "p", children: [{ text: "Before" }] },
      { type: "p", children: [{ text: "After" }] },
    ]);
  });
  it("rejects rewritten words and oversized structured content", () => {
    expect(() =>
      normalizeRichText(
        richTextFromPlain("Changed testimonial"),
        "Original testimonial",
      ),
    ).toThrow();
    expect(() =>
      normalizeRichText(
        Array.from({ length: 101 }, () => ({
          type: "p" as const,
          children: [{ text: "" }],
        })),
        "",
      ),
    ).toThrow();
  });
});
