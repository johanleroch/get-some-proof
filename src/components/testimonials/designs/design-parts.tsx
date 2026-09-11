"use client";

import { safeTestimonialHref } from "@convex/domain/testimonialRichText";
import type { ReactNode } from "react";

import type {
  TestimonialCardTextValue,
  TestimonialCardVideoValue,
} from "@convex/testimonialCardValue";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { accentHighlight } from "@/lib/color-contrast";
import { markerHighlightImage } from "@/lib/marker-highlight";
import { cn } from "@/lib/utils";

/**
 * The pieces every draft design reuses, so a design file holds only what
 * makes it a design: the order of the parts, their sizes and their spacing.
 */

/** The card shell: hairline, `--radius-lg`, no resting shadow (DESIGN.md 7). */
export function DesignCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "bg-card text-card-foreground overflow-hidden rounded-lg border",
        className,
      )}
    >
      {children}
    </article>
  );
}

/**
 * The words. A marked phrase carries the hand-drawn marker swash in the Brand
 * accent, never a coloured box, and the ink is left alone (DESIGN.md 4).
 */
export function DesignQuote({
  accentColor,
  className,
  quoted = false,
  testimonial,
}: {
  accentColor: string;
  className?: string;
  /**
   * Wrap the words in typographic quotation marks. The opening mark hangs
   * into the margin where the browser allows it, so the text edge stays flush
   * with everything else on the card.
   */
  quoted?: boolean;
  testimonial: Pick<TestimonialCardTextValue, "text" | "richText">;
}) {
  const swash = markerHighlightImage(accentHighlight(accentColor));
  const blocks = testimonial.richText ?? [
    { children: [{ text: testimonial.text }], type: "p" as const },
  ];
  const last = blocks.length - 1;
  return (
    <blockquote
      className={cn("text-pretty", className)}
      style={quoted ? { hangingPunctuation: "first" } : undefined}
    >
      {blocks.map((block, blockIndex) => (
        <span className="block" key={blockIndex}>
          {quoted && blockIndex === 0 ? "“" : null}
          {block.children.map((leaf, leafIndex) =>
            leaf.highlight ? (
              <mark
                className="bg-transparent bg-[length:100%_100%] bg-no-repeat px-[0.14em] text-inherit"
                key={leafIndex}
                style={{ backgroundImage: swash }}
              >
                {safeTestimonialHref(leaf.href) ? (
                  <a
                    href={safeTestimonialHref(leaf.href)}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {leaf.text}
                  </a>
                ) : (
                  leaf.text
                )}
              </mark>
            ) : (
              <span key={leafIndex}>
                {safeTestimonialHref(leaf.href) ? (
                  <a
                    href={safeTestimonialHref(leaf.href)}
                    target="_blank"
                    rel="ugc nofollow noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {leaf.text}
                  </a>
                ) : (
                  leaf.text
                )}
              </span>
            ),
          )}
          {quoted && blockIndex === last ? "”" : null}
        </span>
      ))}
    </blockquote>
  );
}

/** Up to three images the Customer attached, under the quote. */
export function DesignImages({
  className,
  testimonial,
}: {
  className?: string;
  testimonial: TestimonialCardTextValue;
}) {
  const images = testimonial.images ?? [];
  if (!images.length) return null;
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(0, 1fr))`,
      }}
    >
      {images.map((image, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`Image ${index + 1} from ${testimonial.name}`}
          className="max-h-80 w-full rounded-lg object-contain"
          key={image.id}
          loading="lazy"
          src={image.url}
        />
      ))}
    </div>
  );
}

/**
 * The Customer's face, 32px round, or nothing: initials are filler, not
 * proof, and the shipped card set that rule (DESIGN.md 7). A design decides
 * what stands in the slot when this returns null.
 */
export function DesignPhoto({
  className,
  testimonial,
}: {
  className?: string;
  testimonial: Pick<TestimonialCardTextValue, "avatarUrl" | "avatarVisible">;
}) {
  if (testimonial.avatarVisible === false || !testimonial.avatarUrl) {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      height={32}
      loading="lazy"
      src={testimonial.avatarUrl}
      width={32}
    />
  );
}

/**
 * Video has one treatment across the product — the poster fills the card, the
 * identity sits on the shade, the play button is 48px — so a draft borrows
 * the real card rather than drawing a copy that could drift from it. A design
 * that wants its own video card writes one and stops calling this.
 */
export function DesignVideoCard({
  accentColor,
  testimonial,
}: {
  accentColor: string;
  testimonial: TestimonialCardVideoValue;
}) {
  return (
    <TestimonialCard accentColor={accentColor} testimonial={testimonial} />
  );
}
