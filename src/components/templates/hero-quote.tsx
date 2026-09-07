import {
  Identity,
  QuoteMark,
  Stars,
  textTestimonials,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * One Testimonial with room to breathe: the opening mark and the stars in
 * the Brand accent, the words in the display face, the person underneath.
 * Picks the first published text Testimonial.
 */
export function HeroQuote({ testimonials }: TemplateRenderProps) {
  const featured = textTestimonials(testimonials)[0];
  if (!featured) return null;
  return (
    <figure className="max-w-2xl space-y-5">
      <QuoteMark size="lg" className="-mb-6" />
      <blockquote className="font-display text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.015em] text-balance @xl:text-[2.125rem]">
        {featured.text}
      </blockquote>
      <figcaption className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <Identity size="lg" testimonial={featured} />
        {featured.rating ? <Stars rating={featured.rating} size={18} /> : null}
      </figcaption>
    </figure>
  );
}
