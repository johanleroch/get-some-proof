"use client";

import { useEffect, useRef, useState } from "react";

import type { WidgetConfig } from "@convex/domain/widgets";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { cn } from "@/lib/utils";
import { WidgetPreview } from "./widget-preview";

/**
 * The widget itself, at half size, cropped by the card (DESIGN.md section 6,
 * Studio grid). The inner host is twice the card's width and scaled to 0.5, so
 * the miniature always fits the column without measuring anything, and the top
 * of the widget stays readable instead of shrinking into grey noise.
 *
 * A Studio holds up to 100 widgets and each preview mounts the real embed
 * runtime, so a card renders nothing until it is close to the viewport.
 */
export function WidgetCardPreview({
  attributionRequired,
  brandName,
  className,
  config,
  customFont,
  fallback,
  googleFont,
  testimonials,
}: {
  attributionRequired: boolean;
  brandName: string;
  className?: string;
  config: WidgetConfig;
  customFont?: { id: string; url: string } | null;
  /** Shown while the card is off screen, and when the widget is still empty. */
  fallback: React.ReactNode;
  googleFont?: string | null;
  testimonials: TestimonialCardValue[];
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element || near) return;
    if (typeof IntersectionObserver === "undefined") {
      const handle = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(handle);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  const empty = testimonials.length === 0;
  return (
    <div
      className={cn(
        "studio-preview-canvas bg-surface-2 relative min-w-0 overflow-hidden",
        className,
      )}
      ref={frame}
    >
      {empty || !near ? (
        <div className="grid h-full place-items-center px-6">{fallback}</div>
      ) : (
        // `inert` rather than `aria-hidden`: the rendered widget carries links
        // and video controls, and hiding a subtree from the accessibility tree
        // while leaving it focusable is a serious violation (axe
        // aria-hidden-focus). `inert` removes it from both.
        <div
          className="pointer-events-none absolute inset-0 w-[200%] origin-top-left scale-50 p-6"
          inert
        >
          <WidgetPreview
            value={{
              attributionRequired,
              brandName,
              config,
              customFont: customFont ?? null,
              googleFont: googleFont ?? null,
              testimonials,
            }}
          />
        </div>
      )}
    </div>
  );
}
