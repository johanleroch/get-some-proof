"use client";

import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import type { CardDesignProps } from "./card-design-types";

/**
 * Editorial — the design the product ships.
 *
 * Its markup is not here: the Wall, the Inbox and the embed share one string
 * of HTML in `src/components/testimonials/testimonial-card-markup.ts`, and
 * this file draws that, so the review page shows the card a visitor really
 * gets instead of a copy that drifts from it. Edit the shipped card there;
 * edit its embed twin in `public/embed/v1.js`, where no Tailwind class of
 * ours applies.
 */
export function EditorialDesign({ accentColor, testimonial }: CardDesignProps) {
  return (
    <TestimonialCard accentColor={accentColor} testimonial={testimonial} />
  );
}
