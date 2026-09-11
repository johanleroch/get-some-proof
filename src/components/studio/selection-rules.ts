import type { TestimonialCardValue } from "@convex/testimonialCardValue";

export function hasHighlight(card: TestimonialCardValue) {
  return (
    card.type === "text" &&
    card.richText?.some((block) =>
      block.children.some((leaf) => leaf.highlight && leaf.text.trim()),
    )
  );
}
