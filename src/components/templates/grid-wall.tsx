import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import { textTestimonials, WallHeader } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Text cards in equal columns with equal heights: the tidy cousin of the
 * masonry Wall, for sections that sit between other blocks of a page.
 */
export function GridWall({
  accentColor,
  brandName,
  testimonials,
}: TemplateRenderProps) {
  const items = textTestimonials(testimonials).slice(0, 6);
  return (
    <div className="space-y-8">
      <WallHeader brandName={brandName} count={items.length} />
      <div className="grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-3 [&_article]:mb-0 [&_article]:h-full">
        {items.map((testimonial) => (
          <TestimonialCard
            accentColor={accentColor}
            key={testimonial.id}
            testimonial={testimonial}
          />
        ))}
      </div>
    </div>
  );
}
