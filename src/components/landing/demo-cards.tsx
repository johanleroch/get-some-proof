import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { cn } from "@/lib/utils";

/**
 * The real Testimonial card, the same markup the Wall, the Inbox and the
 * embed render (`testimonial-card-markup.ts`), laid out in a column. The
 * card carries its own 20px bottom margin for masonry; in a flex column the
 * gap does that work, so the margin is cancelled here.
 */
export function DemoCardColumn({
  accentColor,
  className,
  testimonials,
}: {
  accentColor: string;
  className?: string;
  testimonials: TestimonialCardValue[];
}) {
  return (
    <div
      className={cn(
        // A card truncates its identity line, so its min-content width is the
        // whole name: without `min-w-0` the column refuses to shrink and the
        // card hangs out of its frame on a 320px screen.
        "flex min-w-0 flex-col gap-5 [&_.card]:mb-0 [&_.card]:min-w-0",
        className,
      )}
    >
      {testimonials.map((testimonial) => (
        <TestimonialCard
          accentColor={accentColor}
          key={testimonial.id}
          testimonial={testimonial}
        />
      ))}
    </div>
  );
}

/**
 * The same cards flowing in masonry columns, the way a Wall and the embed
 * lay them out: the card's own bottom margin is the gutter here, so nothing
 * cancels it.
 */
export function DemoCardMasonry({
  accentColor,
  className,
  testimonials,
}: {
  accentColor: string;
  className?: string;
  testimonials: TestimonialCardValue[];
}) {
  return (
    <div
      className={cn(
        "min-w-0 columns-1 gap-5 sm:columns-2 [&_.card]:min-w-0",
        className,
      )}
    >
      {testimonials.map((testimonial) => (
        <TestimonialCard
          accentColor={accentColor}
          key={testimonial.id}
          testimonial={testimonial}
        />
      ))}
    </div>
  );
}
