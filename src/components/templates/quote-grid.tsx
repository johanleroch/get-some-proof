import {
  identityLine,
  QuoteMark,
  Stars,
  textTestimonials,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * No cards and no borders: quotes set straight on the page, a large opening
 * mark in the Brand accent, and a single hairline between cells (the grid
 * gap shows the line token through).
 */
export function QuoteGrid({ testimonials }: TemplateRenderProps) {
  const items = textTestimonials(testimonials).slice(0, 6);
  return (
    <div className="bg-border grid gap-px @xl:grid-cols-2 @3xl:grid-cols-3">
      {items.map((testimonial) => {
        const meta = identityLine(testimonial);
        return (
          <figure
            className="bg-background flex flex-col gap-4 px-6 py-7 @xl:px-7"
            key={testimonial.id}
          >
            <QuoteMark className="-mb-4" />
            <blockquote className="text-[15px] leading-7 font-medium tracking-[-0.011em]">
              {testimonial.text}
            </blockquote>
            <figcaption className="mt-auto space-y-2 pt-2">
              {testimonial.rating ? (
                <Stars rating={testimonial.rating} size={14} />
              ) : null}
              <p className="text-sm font-semibold">{testimonial.name}</p>
              {meta ? (
                <p className="text-muted-foreground text-[13px]">{meta}</p>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
