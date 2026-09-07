"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import { textTestimonials } from "./template-primitives";
import type { TemplateRenderProps } from "./template-types";

const gap = 20;

/**
 * A scroll-snap track: one card per view on phones, two on tablets, three
 * on desktops. The arrows step one card at a time; the counter follows the
 * scroll position so keyboard and touch users see the same state.
 */
export function Carousel({ accentColor, testimonials }: TemplateRenderProps) {
  const items = textTestimonials(testimonials);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  const stepWidth = useCallback(() => {
    const first = trackRef.current?.firstElementChild;
    return (first instanceof HTMLElement ? first.offsetWidth : 320) + gap;
  }, []);

  const syncPosition = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setIndex(Math.round(track.scrollLeft / stepWidth()));
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
  }, [stepWidth]);

  useEffect(() => {
    syncPosition();
    window.addEventListener("resize", syncPosition);
    return () => window.removeEventListener("resize", syncPosition);
  }, [syncPosition]);

  function step(direction: -1 | 1) {
    trackRef.current?.scrollBy({
      behavior: "smooth",
      left: direction * stepWidth(),
    });
  }

  const arrowClass =
    "bg-card hover:bg-muted focus-visible:ring-ring grid size-11 cursor-pointer place-items-center rounded-full border transition-[background-color,translate] duration-150 outline-none focus-visible:ring-[3px] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-5">
      <div
        aria-label="Testimonials"
        className="focus-visible:ring-ring -mx-5 flex snap-x snap-mandatory scrollbar-none gap-5 overflow-x-auto scroll-smooth px-5 outline-none focus-visible:ring-[3px] @xl:-mx-8 @xl:px-8 [&_article]:mb-0 [&_article]:h-full"
        onScroll={syncPosition}
        ref={trackRef}
        role="group"
        tabIndex={0}
      >
        {items.map((testimonial) => (
          <div
            className="w-[85%] shrink-0 snap-start @xl:w-[calc((100%-1.25rem)/2)] @3xl:w-[calc((100%-2.5rem)/3)]"
            key={testimonial.id}
          >
            <TestimonialCard
              accentColor={accentColor}
              testimonial={testimonial}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground type-small tabular-nums">
          {Math.min(index + 1, items.length)} of {items.length}
        </p>
        <div className="flex gap-2">
          <button
            aria-label="Previous testimonials"
            className={arrowClass}
            disabled={index === 0}
            onClick={() => step(-1)}
            type="button"
          >
            <IconChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button
            aria-label="Next testimonials"
            className={arrowClass}
            disabled={atEnd}
            onClick={() => step(1)}
            type="button"
          >
            <IconChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
