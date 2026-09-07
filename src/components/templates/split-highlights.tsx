import {
  Identity,
  QuoteMark,
  Stars,
  textTestimonials,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * Asymmetric by design (DESIGN.md section 6, never three equal cards): one
 * featured Testimonial in a golden 1.618 : 1 split beside two shorter ones
 * stacked on the right. Below 1024px the two small cards sit side by side,
 * then everything stacks on phones.
 */
export function SplitHighlights({ testimonials }: TemplateRenderProps) {
  const [featured, ...rest] = textTestimonials(testimonials);
  if (!featured) return null;
  const supporting = rest.slice(0, 2);
  return (
    <div className="grid gap-5 @3xl:grid-cols-[1.618fr_1fr]">
      <figure className="bg-card flex flex-col justify-between gap-8 rounded-lg border p-6 @xl:p-8">
        <div className="space-y-3">
          <QuoteMark className="-mb-5" />
          <blockquote className="font-display text-2xl leading-snug font-semibold tracking-[-0.01em] text-balance">
            {featured.text}
          </blockquote>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-4">
          <Identity testimonial={featured} />
          {featured.rating ? <Stars rating={featured.rating} /> : null}
        </figcaption>
      </figure>
      <div className="grid gap-5 @xl:grid-cols-2 @3xl:grid-cols-1">
        {supporting.map((testimonial) => (
          <figure
            className="bg-card flex flex-col gap-4 rounded-lg border p-5"
            key={testimonial.id}
          >
            {testimonial.rating ? (
              <Stars rating={testimonial.rating} size={14} />
            ) : null}
            <blockquote className="text-[15px] leading-7 font-medium tracking-[-0.011em]">
              {testimonial.text}
            </blockquote>
            <figcaption className="mt-auto pt-1">
              <Identity size="sm" testimonial={testimonial} />
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
