import { Identity, Stars, textTestimonials } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * A row of short cards that drifts left on its own (see `.template-marquee`
 * in globals.css): the list is rendered twice and the track slides by half
 * its width, so the loop never jumps. Hover or focus pauses it; reduced
 * motion turns it into a plain scrollable row. The duplicate is hidden from
 * assistive technology.
 */
export function Marquee({ testimonials }: TemplateRenderProps) {
  const items = textTestimonials(testimonials);
  const loop = [...items, ...items];
  return (
    <div
      aria-label="Testimonials"
      className="template-marquee focus-visible:ring-ring -mx-5 overflow-hidden px-5 outline-none focus-visible:ring-[3px] motion-safe:[mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] @xl:-mx-8 @xl:px-8"
      role="group"
      tabIndex={0}
    >
      <div className="template-marquee-track flex w-max">
        {loop.map((testimonial, position) => (
          <div
            aria-hidden={position >= items.length ? true : undefined}
            className="w-80 shrink-0 pr-4"
            key={`${testimonial.id}-${position}`}
          >
            <figure className="bg-card flex h-full flex-col gap-3 rounded-lg border p-5">
              {testimonial.rating ? (
                <Stars rating={testimonial.rating} size={14} />
              ) : null}
              <blockquote className="line-clamp-4 text-sm leading-6 font-medium tracking-[-0.008em]">
                {testimonial.text}
              </blockquote>
              <figcaption className="mt-auto pt-1">
                <Identity size="sm" testimonial={testimonial} />
              </figcaption>
            </figure>
          </div>
        ))}
      </div>
    </div>
  );
}
