import { averageRating, Stars } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

/**
 * The smallest proof: five stars in the Brand accent, the average in the
 * display face and the number of customers behind it. Sits on one line in a
 * header or a pricing table.
 */
export function RatingBadge({ testimonials }: TemplateRenderProps) {
  const average = averageRating(testimonials);
  return (
    <div className="bg-card inline-flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border px-5 py-4">
      <Stars rating={average} size={22} />
      <div>
        <p className="font-display text-2xl leading-none font-bold tracking-[-0.01em]">
          {average.toFixed(1)}
          <span className="text-muted-foreground text-base font-medium">
            {" "}
            / 5
          </span>
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm">
          from {testimonials.length} customers
        </p>
      </div>
    </div>
  );
}
