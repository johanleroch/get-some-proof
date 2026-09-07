import type { CSSProperties } from "react";

import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { Sparkle } from "@/components/doodles";
import { cn } from "@/lib/utils";

/**
 * Pieces shared by the templates that do not reuse the testimonial card:
 * stars, avatars, the person line and a Wall header. Everything reads the
 * wall theme tokens and the `--wall-accent` variable set by `TemplateStage`.
 */

const starPath =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z";

export function Stars({
  className,
  rating,
  size = 16,
}: {
  className?: string;
  rating: number;
  size?: number;
}) {
  const filledCount = Math.max(0, Math.min(5, Math.round(rating)));
  // A span, so the stars can sit inside a paragraph (the proof strip).
  return (
    <span
      aria-label={`${filledCount} out of 5 stars`}
      className={cn("inline-flex gap-1 text-(--wall-accent)", className)}
      role="img"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          aria-hidden="true"
          className={cn(
            index < filledCount ? "fill-current" : "text-muted-foreground/25",
          )}
          fill="none"
          height={size}
          key={index}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={size}
        >
          <path d={starPath} />
        </svg>
      ))}
    </span>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Deterministic tint step per person so a stack of initials reads as people. */
function tintPercent(name: string): number {
  const steps = [14, 22, 30, 38, 46];
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return steps[hash % steps.length] ?? 22;
}

export function TemplateAvatar({
  className,
  size = 44,
  testimonial,
}: {
  className?: string;
  size?: number;
  testimonial: Pick<TestimonialCardValue, "avatarUrl" | "name">;
}) {
  const style: CSSProperties = { height: size, width: size };
  if (testimonial.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
        height={size}
        loading="lazy"
        src={testimonial.avatarUrl}
        style={style}
        width={size}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-foreground grid shrink-0 place-items-center rounded-full font-semibold",
        className,
      )}
      style={{
        ...style,
        background: `color-mix(in oklab, var(--wall-accent) ${tintPercent(testimonial.name)}%, var(--card))`,
        fontSize: Math.round(size * 0.34),
      }}
    >
      {initials(testimonial.name)}
    </span>
  );
}

export function identityLine(
  testimonial: Pick<TestimonialCardValue, "company" | "role">,
): string {
  return [testimonial.role, testimonial.company].filter(Boolean).join(" · ");
}

export function Identity({
  className,
  size = "md",
  testimonial,
}: {
  className?: string;
  size?: "lg" | "md" | "sm";
  testimonial: TestimonialCardValue;
}) {
  const meta = identityLine(testimonial);
  const avatarSize = size === "lg" ? 48 : size === "sm" ? 32 : 44;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <TemplateAvatar size={avatarSize} testimonial={testimonial} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold",
            size === "lg" ? "text-base" : "text-sm",
          )}
        >
          {testimonial.name}
        </p>
        {meta ? (
          <p
            className={cn(
              "text-muted-foreground truncate",
              size === "lg" ? "text-sm" : "text-[13px]",
            )}
          >
            {meta}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Opening quotation mark in the display face, in the Brand accent. */
export function QuoteMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "lg" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-display block leading-none font-bold text-(--wall-accent) select-none",
        size === "lg" ? "text-7xl" : "text-5xl",
        className,
      )}
    >
      &ldquo;
    </span>
  );
}

/** The hosted Wall header: eyebrow, Brand name, sparkle, count. */
export function WallHeader({
  brandName,
  count,
}: {
  brandName: string;
  count: number;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="space-y-2">
        <p className="type-micro text-muted-foreground">Customer proof</p>
        <p className="type-display flex items-start gap-3 text-balance">
          <span>{brandName}</span>
          <Sparkle className="mt-1 size-8 shrink-0 text-(--wall-accent)" />
        </p>
      </div>
      <p className="text-muted-foreground type-small">
        {count} {count === 1 ? "proof" : "proofs"}
      </p>
    </header>
  );
}

export function textTestimonials(testimonials: TestimonialCardValue[]) {
  return testimonials.filter(
    (
      testimonial,
    ): testimonial is Extract<TestimonialCardValue, { type: "text" }> =>
      testimonial.type === "text",
  );
}

export function videoTestimonials(testimonials: TestimonialCardValue[]) {
  return testimonials.filter(
    (
      testimonial,
    ): testimonial is Extract<TestimonialCardValue, { type: "video" }> =>
      testimonial.type === "video",
  );
}

export function averageRating(testimonials: TestimonialCardValue[]): number {
  const rated = testimonials.filter((testimonial) => testimonial.rating);
  if (rated.length === 0) return 5;
  const total = rated.reduce(
    (sum, testimonial) => sum + (testimonial.rating ?? 0),
    0,
  );
  return Math.round((total / rated.length) * 10) / 10;
}
