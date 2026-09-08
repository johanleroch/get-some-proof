/**
 * Catalog of the Testimonial card designs. It feeds the development review
 * page at `/kit/testimonials`.
 *
 * One entry per design. The React renderer lives in
 * `src/components/testimonials/designs/<slug>.tsx` and is wired by slug in
 * `src/components/testimonials/designs/card-design-registry.tsx`.
 *
 * Exactly one design is `shipped`: the Wall, the Inbox and the embed share a
 * single markup (`src/components/testimonials/testimonial-card-markup.ts`),
 * so a Brand cannot pick its card the way it picks a wall template yet. The
 * others are `draft` layouts kept here to be finished or dropped; a draft is
 * a sketch in React, not something a Customer can be shown.
 *
 * To add a design: write the file, register it by slug, add an entry here.
 */

export type CardDesignStatus = "draft" | "shipped";

export type CardDesignDefinition = {
  /** Registry key and file name. */
  slug: string;
  name: string;
  /** One sentence under the name, plain voice. */
  description: string;
  /** What this design does that the others do not, for the review page. */
  note: string;
  status: CardDesignStatus;
  /** Component file, shown on the page so the designer can open it. */
  file: string;
};

const file = (slug: string) =>
  `src/components/testimonials/designs/${slug}.tsx`;

export const cardDesigns: CardDesignDefinition[] = [
  {
    slug: "editorial",
    name: "Editorial",
    description:
      "The stars open the card, the quote reads large, and a display quote mark signs the name.",
    note: "The one the product renders. This page draws it with the real component, not a copy, so what you see here is what a visitor sees.",
    status: "shipped",
    file: "src/components/testimonials/testimonial-card-markup.ts",
  },
  {
    slug: "quote-first",
    name: "Quote first",
    description:
      "Nothing above the words; a hairline rules the signature off, and the stars close the row.",
    note: "Redrawn on the Editorial reference: same padding, type, stars and swash. Where Editorial signs with a quote mark, this one signs with a line — the face when the Customer sent one, otherwise the name alone on the rule. The calmest of the set, for a wall that should read like an article.",
    status: "draft",
    file: file("quote-first"),
  },
  {
    slug: "compact",
    name: "Compact",
    description:
      "The person first, on one row with the stars, then the words at body size.",
    note: "Redrawn on the Editorial reference, then tightened where the reference is generous: 20px padding, the quote at body instead of quote, 12px between the row and the words. The only design that leads with who said it — the face when the Customer sent one, otherwise the name alone. The answer to a three-column Wall or the Inbox.",
    status: "draft",
    file: file("compact"),
  },
  {
    slug: "classic-row",
    name: "Classic row",
    description:
      "The words in quotation marks, then the person on one row underneath, like a caption.",
    note: "Redrawn on the Editorial reference: same padding, type, stars, swash and photo. Curly quotes are the signal — the one every visitor already reads as a testimonial — and there is no rule: the row sits close under the words. The shape the product shipped before Editorial and the one nearly every competitor draws, at our quality.",
    status: "draft",
    file: file("classic-row"),
  },
];

export function cardDesignBySlug(
  slug: string,
): CardDesignDefinition | undefined {
  return cardDesigns.find((design) => design.slug === slug);
}

/** The single design the Wall, the Inbox and the embed render today. */
export const shippedCardDesign: CardDesignDefinition = cardDesigns.find(
  (design) => design.status === "shipped",
)!;
