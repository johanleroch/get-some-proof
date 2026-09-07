import type { CSSProperties, ReactNode } from "react";

import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { Sparkle } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  identityLine,
  initials,
  Stars,
  TemplateAvatar,
} from "@/components/templates/template-primitives";
import { cn } from "@/lib/utils";

/**
 * Development review of the Testimonial card UI (DESIGN.md sections 4 and 7).
 * The card is one markup shared by the Wall, the Inbox and the embed, so a
 * variant only changes structure, type scale and spacing: warm neutrals, a
 * `--line` hairline, `--radius-lg`, no resting shadow, and the Brand accent
 * kept for the stars and the quote mark. Pick one here, then port it into
 * `src/components/testimonials/testimonial-card-markup.ts`.
 */

const sampleAccent = "#0f766e";

/** The phrase each sample quote highlights, for variant E. */
const highlights: Record<string, string> = {
  "variant-1": "proof we can actually show",
  "variant-2": "finished the form in two minutes",
  "variant-3": "in one afternoon",
};

const quotes: TestimonialCardValue[] = [
  {
    avatarUrl: null,
    company: "Bellwether Coffee",
    id: "variant-1",
    name: "Alice Martin",
    publishedAt: Date.UTC(2026, 8, 3),
    rating: 5,
    role: "Founder",
    text: "Fernhill turned a folder of kind emails into proof we can actually show. Two new clients mentioned the wall on our first call.",
    type: "text",
  },
  {
    avatarUrl: null,
    id: "variant-2",
    name: "Jordan Lee",
    publishedAt: Date.UTC(2026, 8, 2),
    text: "Our customers finished the form in two minutes. Nobody asked us what they were supposed to write.",
    type: "text",
  },
  {
    avatarUrl: null,
    company: "Signal Works",
    id: "variant-3",
    name: "Morgan Reed",
    publishedAt: Date.UTC(2026, 8, 1),
    rating: 4,
    role: "Operations",
    text: "We went from screenshots in a shared doc to a public wall in one afternoon.",
    type: "text",
  },
];

const videoQuote = {
  aspectRatio: "4:3",
  company: "Tidewater Apps",
  name: "Maya Chen",
  poster:
    "https://image.mux.com/L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y/thumbnail.webp?width=960&time=48",
  rating: 5,
  role: "Product lead",
};

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "bg-card text-card-foreground mb-5 break-inside-avoid overflow-hidden rounded-lg border",
        className,
      )}
    >
      {children}
    </article>
  );
}

/** Shared by every variant: poster, shade, name and the 48px play button. */
function VideoCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <div
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: "4 / 3" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          src={videoQuote.poster}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"
        />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
          <span className="min-w-0">
            {compact ? null : (
              <Stars className="mb-2" rating={videoQuote.rating} size={14} />
            )}
            <span className="block truncate text-lg font-semibold tracking-[-0.015em]">
              {videoQuote.name}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-white/75">
              {videoQuote.role} · {videoQuote.company}
            </span>
          </span>
          <span className="text-ink shadow-float grid size-12 shrink-0 place-items-center rounded-full bg-white/92">
            <svg
              aria-hidden="true"
              className="ml-0.5 size-5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="m6 3 14 9-14 9z" />
            </svg>
          </span>
        </span>
      </div>
    </Card>
  );
}

/** Today's card: identity, then stars, then the quote, all evenly spaced. */
function BaselineCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  return (
    <Card>
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-3">
          <TemplateAvatar size={44} testimonial={testimonial} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{testimonial.name}</p>
            {meta ? (
              <p className="text-muted-foreground truncate text-sm">{meta}</p>
            ) : null}
          </div>
        </div>
        {testimonial.rating ? <Stars rating={testimonial.rating} /> : null}
        <blockquote className="text-[15px] leading-7 font-medium tracking-[-0.01em]">
          {testimonial.text}
        </blockquote>
      </div>
    </Card>
  );
}

/** A. The quote leads; the person signs it under a hairline, stars aligned right. */
function QuoteFirstCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  return (
    <Card>
      <div className="p-5">
        <blockquote className="type-body text-ink text-pretty">
          {testimonial.text}
        </blockquote>
        <div className="border-line mt-5 flex items-center gap-3 border-t pt-4">
          <TemplateAvatar size={36} testimonial={testimonial} />
          <div className="min-w-0 flex-1">
            <p className="type-ui text-ink truncate font-semibold">
              {testimonial.name}
            </p>
            {meta ? (
              <p className="type-small text-ink-2 truncate">{meta}</p>
            ) : null}
          </div>
          {testimonial.rating ? (
            <Stars className="shrink-0" rating={testimonial.rating} size={14} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

/** B. Editorial: a display quote mark in the accent, the quote at reading size. */
function EditorialCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <span
            aria-hidden="true"
            className="font-display -mt-1 block text-4xl leading-none font-bold text-(--wall-accent) select-none"
          >
            &ldquo;
          </span>
          {testimonial.rating ? (
            <Stars
              className="mt-1 shrink-0"
              rating={testimonial.rating}
              size={14}
            />
          ) : null}
        </div>
        <blockquote className="text-ink mt-3 text-[17px] leading-[1.7] text-pretty">
          {testimonial.text}
        </blockquote>
        <p className="mt-5">
          <span className="type-ui text-ink block font-semibold">
            {testimonial.name}
          </span>
          {meta ? (
            <span className="type-small text-ink-2 block">{meta}</span>
          ) : null}
        </p>
      </div>
    </Card>
  );
}

/** C. Compact: one identity row with the stars on it, the quote underneath. */
function CompactCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="type-small text-ink grid size-9 shrink-0 place-items-center rounded-full font-semibold"
            style={{
              background:
                "color-mix(in oklab, var(--wall-accent) 16%, var(--card))",
            }}
          >
            {initials(testimonial.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-ui text-ink truncate font-semibold">
              {testimonial.name}
            </p>
            {meta ? (
              <p className="type-small text-ink-2 truncate">{meta}</p>
            ) : null}
          </div>
          {testimonial.rating ? (
            <Stars className="shrink-0" rating={testimonial.rating} size={14} />
          ) : null}
        </div>
        <blockquote className="type-body text-ink mt-4 text-pretty">
          {testimonial.text}
        </blockquote>
      </div>
    </Card>
  );
}

/**
 * D. What the premium set does (Cursor, Lemon Squeezy, Function, Midday): a
 * quiet tinted fill instead of a card border, the quote first, a small
 * signature, and no stars unless the Brand asks for them.
 */
function FilledCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  return (
    <article className="bg-surface-2 mb-5 break-inside-avoid rounded-lg p-5">
      <blockquote className="type-body text-ink text-pretty">
        {testimonial.text}
      </blockquote>
      <div className="mt-5 flex items-center gap-2.5">
        <TemplateAvatar size={28} testimonial={testimonial} />
        <p className="type-small min-w-0 truncate">
          <span className="text-ink font-semibold">{testimonial.name}</span>
          {meta ? <span className="text-ink-2">{`, ${meta}`}</span> : null}
        </p>
      </div>
    </article>
  );
}

/**
 * E. Clay's move: one phrase of the quote highlighted in the Brand accent, so
 * a wall can be skimmed. The Collection Form already stores those marks.
 */
function HighlightCard({
  testimonial,
}: {
  testimonial: TestimonialCardValue & { type: "text" };
}) {
  const meta = identityLine(testimonial);
  const highlighted = highlights[testimonial.id];
  const [before, after] = highlighted
    ? testimonial.text.split(highlighted)
    : [testimonial.text, ""];
  return (
    <Card>
      <div className="p-5">
        <blockquote className="type-body text-ink text-pretty">
          {before}
          {highlighted ? (
            <mark className="text-ink rounded-[3px] bg-(--wall-accent-soft) px-0.5">
              {highlighted}
            </mark>
          ) : null}
          {after}
        </blockquote>
        <div className="mt-5 flex items-center gap-3">
          <TemplateAvatar size={32} testimonial={testimonial} />
          <div className="min-w-0 flex-1">
            <p className="type-small text-ink truncate font-semibold">
              {testimonial.name}
            </p>
            {meta ? (
              <p className="type-small text-ink-2 truncate">{meta}</p>
            ) : null}
          </div>
          {testimonial.rating ? (
            <Stars className="shrink-0" rating={testimonial.rating} size={13} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

const variants = [
  {
    Render: BaselineCard,
    key: "baseline",
    name: "Current",
    note: "Identity, stars, then the quote, evenly spaced. The person outweighs what they said, and the stars float in the middle.",
  },
  {
    Render: QuoteFirstCard,
    key: "quote-first",
    name: "A · Quote first",
    note: "The quote leads at body size; a hairline separates the signature, avatar 36px, stars aligned right. Calm, reads like a quote.",
  },
  {
    Render: EditorialCard,
    key: "editorial",
    name: "B · Editorial",
    note: "A display quote mark in the Brand accent, the quote at 17px with open leading, no avatar. The most signature, best in one or two columns.",
  },
  {
    Render: CompactCard,
    key: "compact",
    name: "C · Compact",
    note: "One identity row with the stars on it, avatar 36px, then the quote. The densest: best for three-column Walls and the Inbox.",
  },
  {
    Render: FilledCard,
    key: "filled",
    name: "D · Filled, no border",
    note: "What Cursor, Lemon Squeezy, Function and Midday ship: a quiet tinted fill instead of a border, quote first, a one-line signature at 28px, and no stars. The lightest wall.",
  },
  {
    Render: HighlightCard,
    key: "highlight",
    name: "E · Highlighted phrase",
    note: "Clay's move: one phrase marked in the Brand accent so a long wall can be skimmed. The Collection Form already stores these marks; today they paint in a hard-coded yellow.",
  },
] as const;

export function TestimonialCardVariants() {
  return (
    <div
      className="bg-background text-foreground min-h-svh"
      style={
        {
          "--wall-accent": sampleAccent,
          "--wall-accent-soft": `color-mix(in oklab, ${sampleAccent} 22%, var(--card))`,
        } as CSSProperties
      }
    >
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading flex items-center gap-2">
              Testimonial card
              <Sparkle className="text-brand size-5" />
            </h1>
            <p className="text-muted-foreground type-small">
              {variants.length - 1} variants against today&apos;s card, informed
              by Mobbin. Development only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">Kit</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/kit/templates">Templates</a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-14 px-6 py-10">
        {variants.map((variant) => (
          <section className="space-y-5" key={variant.key}>
            <div className="max-w-prose space-y-1">
              <h2 className="type-heading">{variant.name}</h2>
              <p className="type-body text-ink-2">{variant.note}</p>
            </div>
            <div className="bg-surface-2 rounded-lg border p-5">
              <div className="columns-1 gap-5 md:columns-2 xl:columns-3">
                {quotes.map((testimonial) =>
                  testimonial.type === "text" ? (
                    <variant.Render
                      key={testimonial.id}
                      testimonial={testimonial}
                    />
                  ) : null,
                )}
                <VideoCard compact={variant.key === "compact"} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
