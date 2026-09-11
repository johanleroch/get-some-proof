import type { TestimonialCardValue } from "@convex/testimonialCardValue";

export function hasHighlight(card: TestimonialCardValue) {
  return (
    card.type === "text" &&
    card.richText?.some((block) =>
      block.children.some((leaf) => leaf.highlight && leaf.text.trim()),
    )
  );
}

export function selectAllWithinLimit(
  currentIds: string[],
  candidateIds: string[],
  limit = 50,
) {
  const next = new Set(currentIds);
  for (const id of candidateIds) {
    if (next.size >= limit) break;
    next.add(id);
  }
  return [...next];
}
