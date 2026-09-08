"use client";

import type { CSSProperties, ReactNode } from "react";

import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";

/** A wall column at three columns on a laptop: the width a card is judged at. */
export const wallCardWidth = 340;

function aspect(aspectRatio?: string): [number, number] {
  const match = /^(\d{1,5}):(\d{1,5})$/.exec(aspectRatio ?? "");
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) return [9, 16];
  return [Number(match[1]), Number(match[2])];
}

/**
 * The published video card exactly as the Wall draws it, then scaled down as
 * one picture — so the stars, the name and the 48px play button shrink with
 * the poster instead of keeping their wall size on a narrower card and
 * crowding it. Layout is reserved for the scaled size, so the miniature sits
 * in a column like any image.
 */
export function WallCardMiniature({
  accentColor,
  children,
  testimonial,
  width,
}: {
  accentColor: string;
  /** Drawn over the miniature, in its own coordinates (a loading line, say). */
  children?: ReactNode;
  testimonial: TestimonialCardVideoValue;
  /** The width the miniature takes on screen. */
  width: number;
}) {
  const scale = width / wallCardWidth;
  const [ratioWidth, ratioHeight] = aspect(testimonial.aspectRatio);
  // The poster at wall width, plus the card's hairline above and below.
  const cardHeight = (wallCardWidth * ratioHeight) / ratioWidth + 2;
  const style: CSSProperties = { height: cardHeight * scale, width };
  return (
    <div className="relative overflow-hidden" style={style}>
      <div
        className="origin-top-left"
        style={{ transform: `scale(${scale})`, width: wallCardWidth }}
      >
        <TestimonialCard accentColor={accentColor} testimonial={testimonial} />
      </div>
      {children}
    </div>
  );
}
