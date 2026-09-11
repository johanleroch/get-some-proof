import { expect, it } from "vitest";
import {
  normalizeRichText,
  publicRichText,
  safeTestimonialHref,
} from "./testimonialRichText";

it.each([
  "javascript:alert(1)",
  "data:text/html,x",
  "//example.com",
  "https://user:secret@example.com",
  "not a url",
  "https://",
  "https://example.com/" + "a".repeat(2048),
])("drops unsafe destination %s", (href) => {
  expect(safeTestimonialHref(href)).toBeUndefined();
});
it("keeps words and highlights while reversibly excluding all public destinations", () => {
  const value = [
    {
      type: "p" as const,
      children: [
        { text: "@atelier", highlight: true, href: "https://example.com" },
      ],
    },
  ];
  const normalized = normalizeRichText(value, "@atelier");
  expect(normalized?.[0].children[0].href).toBe("https://example.com/");
  expect(publicRichText(normalized, false)).toEqual([
    { type: "p", children: [{ text: "@atelier", highlight: true }] },
  ]);
  expect(publicRichText(normalized, true)).toEqual(normalized);
});

it("bounds aggregate destination bytes before persistence", () => {
  const value = [
    {
      type: "p" as const,
      children: Array.from({ length: 100 }, () => ({
        text: "a",
        href: "https://example.com/" + "x".repeat(1800),
      })),
    },
  ];
  expect(() => normalizeRichText(value, "a".repeat(100))).toThrow("too large");
});
