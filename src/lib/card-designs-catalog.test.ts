import { describe, expect, it } from "vitest";

import { cardDesignComponents } from "@/components/testimonials/designs/card-design-registry";
import { cardDesignSamples } from "@/lib/card-design-samples";
import {
  cardDesignBySlug,
  cardDesigns,
  shippedCardDesign,
} from "@/lib/card-designs-catalog";

describe("card designs catalog", () => {
  it("uses unique slugs and gives every design a renderer", () => {
    const slugs = cardDesigns.map((design) => design.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const design of cardDesigns) {
      expect(design.slug).toMatch(/^[a-z0-9-]+$/);
      expect(cardDesignComponents[design.slug]).toBeTypeOf("function");
      expect(design.description.endsWith(".")).toBe(true);
    }
    // No orphan renderer either: a design nobody lists never gets reviewed.
    expect(Object.keys(cardDesignComponents).sort()).toEqual(slugs.sort());
  });

  it("ships exactly one design, and it points at the shared markup", () => {
    const shipped = cardDesigns.filter((design) => design.status === "shipped");
    expect(shipped).toHaveLength(1);
    expect(shippedCardDesign.slug).toBe("editorial");
    // The Wall, the Inbox and the embed share one markup; a second shipped
    // design would be a promise the product cannot keep.
    expect(shippedCardDesign.file).toBe(
      "src/components/testimonials/testimonial-card-markup.ts",
    );
    expect(cardDesigns.some((design) => design.status === "draft")).toBe(true);
  });

  it("keeps a draft's file next to its slug", () => {
    for (const design of cardDesigns) {
      if (design.status === "shipped") continue;
      expect(design.file).toBe(
        `src/components/testimonials/designs/${design.slug}.tsx`,
      );
    }
  });

  it("finds a design by slug", () => {
    expect(cardDesignBySlug("compact")?.name).toBe("Compact");
    expect(cardDesignBySlug("nope")).toBeUndefined();
  });

  it("covers every form a Customer can send", () => {
    const keys = cardDesignSamples.map((sample) => sample.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("video");
    // A highlighted phrase, attached photos and a signature with nothing but
    // the name are the three shapes that break a card; the page must always
    // show them.
    const text = cardDesignSamples.filter(
      (sample) => sample.testimonial.type === "text",
    );
    expect(
      text.some(
        (sample) =>
          sample.testimonial.type === "text" &&
          sample.testimonial.richText?.some((block) =>
            block.children.some((leaf) => leaf.highlight),
          ),
      ),
    ).toBe(true);
    expect(
      text.some(
        (sample) =>
          sample.testimonial.type === "text" &&
          (sample.testimonial.images?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(
      text.some(
        (sample) => !sample.testimonial.role && !sample.testimonial.company,
      ),
    ).toBe(true);
  });
});
