import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import { WallHeader } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * The hosted Wall as it ships today (DESIGN.md section 6): header with the
 * Brand name and its scribble star, then a masonry of one, two or three
 * columns in the curated order, text and video mixed.
 */
export function MasonryWall({
  accentColor,
  brandName,
  testimonials,
}: TemplateRenderProps) {
  return (
    <div className="space-y-8">
      <WallHeader brandName={brandName} count={testimonials.length} />
      <div className="columns-1 gap-5 @xl:columns-2 @3xl:columns-3">
        {testimonials.map((testimonial) => (
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
