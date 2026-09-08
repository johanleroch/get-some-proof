"use client";

import type { CSSProperties, ReactNode } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";

import { CameraTripod, Sparkle, SpeechBubbleStars } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Development review of the Collection Form's first question, "What would you
 * like to share?" (DESIGN.md sections 4, 6 and 7). The founder chose tiles
 * side by side on a wide column and bands on a narrow one, so this is the
 * refining round: four ways to draw each. Everything sits on the same rules —
 * `--surface` on a `--line` hairline, `--radius-lg`, no resting shadow, the
 * customer's accent only on hover and focus, and the hand-drawn spots
 * carrying the meaning instead of a filled icon tile.
 *
 * Pick one of each, then port them into `ProofTypeStep` in
 * `src/components/collection/collection-form-shell.tsx` and mirror them in
 * `src/components/organizations/collection-form-preview.tsx`.
 */

const sampleAccent = "#0f766e";

const formats = [
  {
    hint: "Write 20 to 2,000 characters",
    key: "text",
    label: "Send a text testimonial",
    verb: "Write it",
    Spot: SpeechBubbleStars,
  },
  {
    hint: "Up to 2 minutes",
    key: "video",
    label: "Record or upload a video",
    verb: "Film it",
    Spot: CameraTripod,
  },
] as const;

/** Every option shares these; only the arrangement changes between variants. */
const tile =
  "border-line bg-surface flex cursor-pointer rounded-lg border text-left transition-colors duration-150 hover:border-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)";

function Question() {
  return (
    <div>
      <h3 className="type-subheading">What would you like to share?</h3>
      <p className="text-ink-2 type-small mt-1">
        Choose one format. Nothing is saved until you confirm.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- A, wide */

/** A1: today's tile. Drawing top left, label, hint, everything ranged left. */
function A1() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map(({ hint, key, label, Spot }) => (
        <button
          className={cn(tile, "flex-col gap-4 p-5")}
          key={key}
          type="button"
        >
          <Spot className="text-ink h-16" />
          <span>
            <span className="type-ui block font-semibold">{label}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A2: the same tile centred, so the pair balances. */
function A2() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map(({ hint, key, label, Spot }) => (
        <button
          className={cn(tile, "flex-col items-center gap-4 p-5 text-center")}
          key={key}
          type="button"
        >
          <Spot className="text-ink h-[72px]" />
          <span>
            <span className="type-ui block font-semibold">{label}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A3: the verb leads and the sentence goes. Fewest words, biggest drawing. */
function A3() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map(({ hint, key, Spot, verb }) => (
        <button
          className={cn(
            tile,
            "flex-col items-center gap-4 px-5 py-6 text-center",
          )}
          key={key}
          type="button"
        >
          <Spot className="text-ink h-20" />
          <span>
            <span className="type-subheading block">{verb}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A4: two zones, the drawing on its own tinted band above the hairline. */
function A4() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {formats.map(({ hint, key, label, Spot }) => (
        <button
          className={cn(tile, "flex-col overflow-hidden")}
          key={key}
          type="button"
        >
          <span className="bg-surface-2 border-line grid w-full place-items-center border-b py-5">
            <Spot className="text-ink h-14" />
          </span>
          <span className="px-4 py-3">
            <span className="type-ui block font-semibold">{label}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- D, narrow */

/** D1: today's band. The verb leads, the detail follows, drawing right. */
function D1() {
  return (
    <div className="space-y-3">
      {formats.map(({ hint, key, label, Spot, verb }) => (
        <button
          className={cn(tile, "w-full items-center gap-4 py-4 pr-4 pl-5")}
          key={key}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="type-subheading block">{verb}</span>
            <span className="text-ink-2 type-small mt-0.5 block">{label}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
          <Spot className="text-ink h-14 shrink-0" />
        </button>
      ))}
    </div>
  );
}

/** D2: the label leads, so the phone and the desktop say the same words. */
function D2() {
  return (
    <div className="space-y-3">
      {formats.map(({ hint, key, label, Spot }) => (
        <button
          className={cn(tile, "w-full items-center gap-4 py-4 pr-4 pl-5")}
          key={key}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="type-ui block font-semibold">{label}</span>
            <span className="text-ink-2 type-small mt-0.5 block">{hint}</span>
          </span>
          <Spot className="text-ink h-14 shrink-0" />
        </button>
      ))}
    </div>
  );
}

/** D3: drawing first, chevron last, the reading order of a list row. */
function D3() {
  return (
    <div className="space-y-3">
      {formats.map(({ hint, key, label, Spot }) => (
        <button
          className={cn(tile, "group w-full items-center gap-4 p-4")}
          key={key}
          type="button"
        >
          <Spot className="text-ink h-12 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="type-ui block font-semibold">{label}</span>
            <span className="text-ink-2 type-small block">{hint}</span>
          </span>
          <IconChevronRight
            aria-hidden="true"
            className="text-ink-3 size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </button>
      ))}
    </div>
  );
}

/** D4: one line each, the shortest band that still says everything. */
function D4() {
  return (
    <div className="space-y-3">
      {formats.map(({ hint, key, Spot, verb }) => (
        <button
          className={cn(tile, "w-full items-center gap-4 py-3 pr-3 pl-5")}
          key={key}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="type-ui font-semibold">{verb}</span>
            <span className="text-ink-2 type-small ml-2">{hint}</span>
          </span>
          <Spot className="text-ink h-12 shrink-0" />
        </button>
      ))}
    </div>
  );
}

const wide: { body: ReactNode; idea: string; name: string }[] = [
  {
    body: <A1 />,
    idea: "The tile as it stands. Drawing top left, label, hint: everything ranged left, so each tile reads as its own little column.",
    name: "A1 · Ranged left",
  },
  {
    body: <A2 />,
    idea: "The same tile centred, drawing a touch larger. The pair balances, and the choice reads as two posters rather than two blocks of text.",
    name: "A2 · Centred",
  },
  {
    body: <A3 />,
    idea: "Shipped from 640px. The verb leads and the long sentence goes: fewest words, biggest drawing.",
    name: "A3 · Verb led",
  },
  {
    body: <A4 />,
    idea: "Two zones: the drawing on its own tinted band above the hairline, the words below. The most structured, and the closest to a card.",
    name: "A4 · Two zones",
  },
];

const narrow: { body: ReactNode; idea: string; name: string }[] = [
  {
    body: <D1 />,
    idea: "Shipped. The verb at subheading, then the sentence and the count each on their own line, the drawing balancing on the right.",
    name: "D1 · Verb led",
  },
  {
    body: <D2 />,
    idea: "The label leads instead of the verb, so the phone and the desktop say the same words. Quieter, and one vocabulary everywhere.",
    name: "D2 · Label led",
  },
  {
    body: <D3 />,
    idea: "Drawing first, chevron last: the reading order of a list row, with the drawing where an icon would sit. The most familiar gesture.",
    name: "D3 · Drawing first",
  },
  {
    body: <D4 />,
    idea: "One line each. The verb and the hint share a row and the band loses a third of its height: the most screen left for the rest of the form.",
    name: "D4 · One line",
  },
];

/** Each variant is judged at the width its own breakpoint really gives it. */
function Frame({ children, width }: { children: ReactNode; width: number }) {
  return (
    <div className="bg-paper rounded-xl border p-6">
      <div className="mx-auto space-y-4" style={{ maxWidth: width }}>
        <Question />
        {children}
      </div>
    </div>
  );
}

export function ProofFormatVariants() {
  return (
    <div
      className="bg-background text-foreground min-h-svh"
      style={{ "--accent": sampleAccent } as CSSProperties}
    >
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading flex items-center gap-2">
              Collection Form, first question
              <Sparkle className="text-brand size-5" />
            </h1>
            <p className="text-muted-foreground type-small">
              Tiles from 640px, bands below. Four ways to draw each. Development
              only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">Kit</a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/visual-evidence/collection-form">Live step</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-14 px-6 py-10">
        <section className="space-y-6">
          <div className="max-w-prose space-y-1">
            <h2 className="type-display">A · Tiles, wide column</h2>
            <p className="text-ink-2 type-body">
              At 520px, the width the form column reaches from 640px up. Two
              tiles side by side, the drawing saying text or video before a word
              is read.
            </p>
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            {wide.map((variant) => (
              <div className="space-y-3" key={variant.name}>
                <div className="max-w-prose space-y-1">
                  <h3 className="type-heading">{variant.name}</h3>
                  <p className="text-ink-2 type-small">{variant.idea}</p>
                </div>
                <Frame width={520}>{variant.body}</Frame>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="max-w-prose space-y-1">
            <h2 className="type-display">D · Bands, narrow column</h2>
            <p className="text-ink-2 type-body">
              At 335px, what a 375px phone leaves once the page padding is
              taken. One band per format, stacked.
            </p>
          </div>
          <div className="grid gap-8 xl:grid-cols-2">
            {narrow.map((variant) => (
              <div className="space-y-3" key={variant.name}>
                <div className="max-w-prose space-y-1">
                  <h3 className="type-heading">{variant.name}</h3>
                  <p className="text-ink-2 type-small">{variant.idea}</p>
                </div>
                <Frame width={335}>{variant.body}</Frame>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
