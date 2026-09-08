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
 * Quote first — draft, redrawn on the Editorial reference.
 *
 * Nothing above the words: the quote opens the card at `quote`, the way a
 * pull quote opens a page. A hairline then rules the signature off from what
 * was said, and the person signs under it — their face when they sent one,
 * otherwise the name alone, flush on the rule; the stars close the row on
 * the right. Where Editorial signs with a quote mark, this card signs with a
 * line: the calmest of the set, for a Brand whose wall should read like an
 * article rather than a feed.
 *
 * Shares with Editorial: 24px padding, the `quote`, `ui` and `small` styles,
 * 14px stars in the Brand accent, the marker swash, a 32px photo and never
 * initials.
 */
export function QuoteFirstDesign({
  accentColor,
  testimonial,
}: CardDesignProps) {
  if (testimonial.type === "video") {
    return (
      <DesignVideoCard accentColor={accentColor} testimonial={testimonial} />
    );
  }
  const meta = identityLine(testimonial);
  return (
    <DesignCard>
      <div className="p-6">
        <DesignQuote
          accentColor={accentColor}
          className="type-quote text-ink"
          testimonial={testimonial}
        />
        <DesignImages className="mt-5" testimonial={testimonial} />
        <div className="border-line mt-5 flex items-center gap-3 border-t pt-4">
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
      </div>
    </DesignCard>
  );
}
