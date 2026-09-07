import {
  Identity,
  Stars,
  textTestimonials,
  WallHeader,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Lists over cards: one row per Testimonial with a hairline between rows,
 * the person and their stars in a fixed left column, the words on the right.
 */
export function ListWall({ brandName, testimonials }: TemplateRenderProps) {
  const items = textTestimonials(testimonials).slice(0, 5);
  return (
    <div className="space-y-6">
      <WallHeader brandName={brandName} count={items.length} />
      <ul className="divide-y">
        {items.map((testimonial) => (
          <li
            className="grid gap-4 py-6 first:pt-2 last:pb-2 @xl:grid-cols-[14rem_minmax(0,1fr)] @xl:gap-10"
            key={testimonial.id}
          >
            <div className="space-y-3">
              <Identity testimonial={testimonial} />
              {testimonial.rating ? (
                <Stars rating={testimonial.rating} />
              ) : null}
            </div>
            <blockquote className="max-w-prose text-[17px] leading-7 font-medium tracking-[-0.011em]">
              {testimonial.text}
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
}
