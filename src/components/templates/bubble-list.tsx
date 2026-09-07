import {
  identityLine,
  Stars,
  TemplateAvatar,
  textTestimonials,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Speech bubbles: avatar on the left, the words in a bubble whose top-left
 * corner is squared toward the speaker, the name and stars underneath.
 */
export function BubbleList({ testimonials }: TemplateRenderProps) {
  const items = textTestimonials(testimonials).slice(0, 4);
  return (
    <ul className="max-w-xl space-y-5">
      {items.map((testimonial) => {
        const meta = identityLine(testimonial);
        return (
          <li className="flex items-start gap-3" key={testimonial.id}>
            <TemplateAvatar size={36} testimonial={testimonial} />
            <div className="min-w-0 space-y-1.5">
              <div className="bg-card rounded-lg rounded-tl-sm border px-4 py-3">
                <p className="text-[15px] leading-6 font-medium tracking-[-0.011em]">
                  {testimonial.text}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
                <p className="text-[13px]">
                  <span className="font-semibold">{testimonial.name}</span>
                  {meta ? (
                    <span className="text-muted-foreground"> · {meta}</span>
                  ) : null}
                </p>
                {testimonial.rating ? (
                  <Stars rating={testimonial.rating} size={12} />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
