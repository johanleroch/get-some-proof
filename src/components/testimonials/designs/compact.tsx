"use client";

import {
  identityLine,
  Stars,
} from "@/components/templates/template-primitives";

import type { CardDesignProps } from "./card-design-types";
import {
  DesignCard,
  DesignImages,
  DesignPhoto,
  DesignQuote,
  DesignVideoCard,
} from "./design-parts";

/**
 * Compact — draft, redrawn on the Editorial reference and then tightened
 * wherever the reference is generous.
 *
 * The only design that leads with who said it: one row with the face when
 * the Customer sent one, the name and role, and the stars on the right; then
 * the words at `body` rather than `quote`, 12px below. Padding 20px, not 24.
 * Every step is one notch denser so a three-column Wall or the Inbox fits the
 * most proof per screen without looking cramped.
 *
 * Shares with Editorial: the `ui` and `small` styles for the person, 14px
 * stars in the Brand accent, the marker swash, a 32px photo and never
 * initials — with no face the name sits flush, nothing fills the slot.
 */
export function CompactDesign({ accentColor, testimonial }: CardDesignProps) {
  if (testimonial.type === "video") {
    return (
      <DesignVideoCard accentColor={accentColor} testimonial={testimonial} />
    );
  }
  const meta = identityLine(testimonial);
  return (
    <DesignCard>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <DesignPhoto testimonial={testimonial} />
          <p className="min-w-0 flex-1">
            <span className="type-ui text-ink block truncate font-semibold">
              {testimonial.name}
            </span>
            {meta ? (
              <span className="type-small text-ink-2 block truncate">
                {meta}
              </span>
            ) : null}
          </p>
          {testimonial.rating ? (
            <Stars className="shrink-0" rating={testimonial.rating} size={14} />
          ) : null}
        </div>
        <DesignQuote
          accentColor={accentColor}
          className="type-body text-ink mt-3"
          testimonial={testimonial}
        />
        <DesignImages className="mt-4" testimonial={testimonial} />
      </div>
    </DesignCard>
  );
}
