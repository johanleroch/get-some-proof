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
 * Classic row — draft, redrawn on the Editorial reference.
 *
 * The card every visitor already knows how to read: the words in quotation
 * marks, then the person on one row underneath, like a caption — their face
 * when they sent one, the name and role, the stars on the right. No rule and
 * no display mark: the curly quotes are the signal, the one nearly every
 * competitor draws, and the row sits close under the words so the two read
 * as a unit.
 *
 * Shares with Editorial: 24px padding, the `quote`, `ui` and `small` styles,
 * 14px stars in the Brand accent, the marker swash, a 32px photo and never
 * initials. Where Editorial signs with a display mark and Quote first with a
 * line, this one quotes.
 */
export function ClassicRowDesign({
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
          quoted
          testimonial={testimonial}
        />
        <DesignImages className="mt-5" testimonial={testimonial} />
        <div className="mt-4 flex items-center gap-3">
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
