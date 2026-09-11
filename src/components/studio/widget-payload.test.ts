import { describe, expect, it } from "vitest";
import { widgetPayload } from "./widget-payload";
const config = {
  layout: "highlights" as const,
  font: "inherit" as const,
  accentColor: "#ffbb16",
  backgroundColor: "#ffffff",
  textColor: "#2e2a25",
};
describe("widget public presentation", () => {
  it("uses only existing highlighted phrases, without inventing a rating", () => {
    const payload = widgetPayload({
      config,
      brandName: "Cedar Workshop",
      attributionRequired: true,
      testimonials: [
        {
          id: "one",
          name: "Maya",
          avatarUrl: null,
          publishedAt: 1,
          type: "text",
          text: "Before. Saved us hours. After.",
          richText: [
            {
              type: "p",
              children: [
                { text: "Before. " },
                {
                  text: "Saved us hours.",
                  highlight: true,
                  href: "https://example.com/review",
                },
                { text: " After." },
              ],
            },
          ],
        },
      ],
    });
    expect(payload.testimonials[0].html).toContain("Saved us hours.");
    expect(payload.testimonials[0].html).toContain(
      'href="https://example.com/review"',
    );
    expect(payload.testimonials[0].html).not.toContain("Before.");
    expect(payload.testimonials[0].html).not.toContain("out of 5 stars");
  });
});
