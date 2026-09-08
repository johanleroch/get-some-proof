import {
  Identity,
  QuoteMark,
  Stars,
  textTestimonials,
} from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * One Testimonial with room to breathe. The rating opens the card, because a
 * visitor scanning a Wall reads the stars before the sentence; the mark
 * closes it instead of opening it, mirrored at the end of the words the way
 * a pull quote closes, and the person signs underneath. Both stay in the
 * Brand accent. Picks the first published text Testimonial.
 */
export function HeroQuote({ testimonials }: TemplateRenderProps) {
  const featured = textTestimonials(testimonials)[0];
  if (!featured) return null;
  return (
    // The quote keeps its measure and the person takes the room left over.
    // Widening the sentence instead would push it from 40 to nearly 70
    // characters a line at 34px, past the limit in DESIGN.md section 3 and
    // well past what a display-size pull quote can carry. 36rem holds about
    // 34 characters, which is where display type reads best, and leaves the
    // right column enough width for a signature from 896px on.
    <figure className="grid gap-6 @4xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] @4xl:gap-10">
      <div className="space-y-5">
        {featured.rating ? (
          <Stars rating={featured.rating} size={20} />
        ) : (
          <QuoteMark className="-mb-6" size="lg" />
        )}
        <blockquote className="font-display text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.015em] text-balance @xl:text-[2.125rem]">
          {featured.text}
        </blockquote>
      </div>
      {/* Stacked, the person signs under the quote with the mark closing on
          the right. Split, the column reverses so the mark opens the right
          side and the signature settles level with the last line. */}
      <figcaption className="flex flex-wrap items-end justify-between gap-4 pt-1 @4xl:flex-col-reverse @4xl:flex-nowrap @4xl:items-end @4xl:justify-between @4xl:pt-0">
        <Identity size="lg" testimonial={featured} />
        {featured.rating ? (
          <QuoteMark
            className="-mb-3 rotate-180 opacity-60 @5xl:mb-0"
            size="lg"
          />
        ) : null}
      </figcaption>
    </figure>
  );
}
