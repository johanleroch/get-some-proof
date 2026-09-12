"use client";

import type { ReactNode } from "react";
import { IconArrowLeft, IconSend, IconTrash } from "@tabler/icons-react";
import Link from "next/link";

import { MarkerHighlight } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Development review of the status pill (DESIGN.md sections 2.3, 5 and 7).
 * The founder picked the chip — one neutral fill for every state, the color
 * held in the dot alone — and asked for that fill to be white. This page now
 * settles the one thing white raises: a white chip melts into the white cards
 * the Studio list and the Inbox are made of, which is accepted — the dot
 * carries the state there. The flavor weighed against it and the four
 * original treatments stay for the record; `src/components/ui/badge.tsx` and
 * DESIGN.md section 7 now carry the shipped chip.
 */

type Tone = "brand" | "danger" | "info" | "neutral" | "success" | "warning";

/** Where the pill sits, which is what the "flip" flavor reacts to. */
type Ground = "card" | "paper";

type Design = "chip-flat" | "chip-flip" | "ink" | "marker" | "tint";

/**
 * One row per status: the dot color, the soft fill, the label color, and the
 * deeper tint the hand-drawn swipe is painted with (a `-soft-2` step, derived
 * from the status token the same way the brand derives its own).
 */
const tones: Record<
  Tone,
  { dot: string; fill: string; label: string; swipe: string }
> = {
  brand: {
    dot: "bg-brand",
    fill: "bg-brand-soft",
    label: "text-brand-text",
    swipe: "text-brand-soft-2",
  },
  danger: {
    dot: "bg-danger",
    fill: "bg-danger-soft",
    label: "text-danger",
    swipe:
      "text-[oklch(from_var(--danger)_0.9_0.08_h)] dark:text-[oklch(from_var(--danger)_0.36_0.08_h)]",
  },
  info: {
    dot: "bg-info",
    fill: "bg-info-soft",
    label: "text-info",
    swipe:
      "text-[oklch(from_var(--info)_0.9_0.06_h)] dark:text-[oklch(from_var(--info)_0.36_0.06_h)]",
  },
  neutral: {
    dot: "bg-ink-3",
    fill: "bg-surface-2",
    label: "text-ink-2",
    swipe: "text-[oklch(0.93_0.012_80)] dark:text-[oklch(0.34_0.012_60)]",
  },
  success: {
    dot: "bg-success",
    fill: "bg-success-soft",
    label: "text-success",
    swipe:
      "text-[oklch(from_var(--success)_0.9_0.07_h)] dark:text-[oklch(from_var(--success)_0.36_0.07_h)]",
  },
  warning: {
    dot: "bg-warning",
    fill: "bg-warning-soft",
    label: "text-warning",
    swipe:
      "text-[oklch(from_var(--warning)_0.9_0.08_h)] dark:text-[oklch(from_var(--warning)_0.36_0.08_h)]",
  },
};

/** The label metrics every variant shares, straight from today's Badge. */
const label =
  "text-[13px] leading-none font-medium tracking-[-0.004em] whitespace-nowrap";

/** The chip shell: fully round, 24px tall, the dot tucked against the left. */
const chip =
  "text-ink inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-2";

function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full", tones[tone].dot)}
    />
  );
}

function Pill({
  children,
  className,
  design,
  ground = "paper",
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  design: Design;
  ground?: Ground;
  tone?: Tone;
}) {
  const t = tones[tone];

  if (design === "ink") {
    return (
      <span
        className={cn(
          "inline-flex h-6 w-fit shrink-0 items-center gap-1.5",
          label,
          t.label,
          className,
        )}
      >
        <Dot tone={tone} />
        {children}
      </span>
    );
  }

  if (design === "tint") {
    return (
      <span
        className={cn(
          "inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2.5",
          label,
          t.fill,
          t.label,
          className,
        )}
      >
        {children}
      </span>
    );
  }

  if (design === "marker") {
    return (
      <span
        className={cn(
          "relative inline-flex h-6 w-fit shrink-0 items-center px-1.5",
          label,
          t.label,
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-[-3px] top-[3px] bottom-[2px]"
        >
          <MarkerHighlight className={cn("h-full w-full", t.swipe)} />
        </span>
        <span className="relative">{children}</span>
      </span>
    );
  }

  // The three ways to make the chip white.
  return (
    <span
      className={cn(
        chip,
        label,
        design === "chip-flip" && ground === "card"
          ? "bg-paper dark:bg-surface-2"
          : "bg-chip",
        className,
      )}
    >
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** The seven tags the product ships today, in one row. */
function PillSet({ design, ground }: { design: Design; ground: Ground }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Pill design={design} ground={ground} tone="success">
        Published
      </Pill>
      <Pill design={design} ground={ground} tone="warning">
        Unpublished changes
      </Pill>
      <Pill design={design} ground={ground} tone="warning">
        Pending
      </Pill>
      <Pill design={design} ground={ground} tone="danger">
        Failed
      </Pill>
      <Pill design={design} ground={ground} tone="info">
        Processing
      </Pill>
      <Pill design={design} ground={ground} tone="brand">
        Pro
      </Pill>
      <Pill design={design} ground={ground} tone="neutral">
        Draft
      </Pill>
      <Pill design={design} ground={ground} tone="neutral">
        12 proofs
      </Pill>
    </div>
  );
}

const widgets = [
  { meta: "Grid · 6 selected", name: "Bakery homepage wall", tone: "success" },
  {
    meta: "Carousel · 3 selected",
    name: "Checkout proof strip",
    tone: "warning",
  },
  { meta: "List · 4 selected", name: "Pricing page quotes", tone: "neutral" },
] as const satisfies ReadonlyArray<{
  meta: string;
  name: string;
  tone: Tone;
}>;

const widgetLabels: Record<Tone, string> = {
  brand: "Pro",
  danger: "Failed",
  info: "Processing",
  neutral: "Draft",
  success: "Published",
  warning: "Unpublished changes",
};

/** The Studio list: a white card, where a white chip has to hold its own. */
function StudioList({
  compact = false,
  design,
}: {
  compact?: boolean;
  design: Design;
}) {
  return (
    <div className="border-line bg-surface divide-line divide-y rounded-lg border">
      {(compact ? widgets.slice(0, 2) : widgets).map((widget) => (
        <div className="flex items-center gap-3 p-4" key={widget.name}>
          <div className="min-w-0 flex-1">
            <span className="type-ui block truncate font-semibold">
              {widget.name}
            </span>
            <span className="type-small text-ink-2">{widget.meta}</span>
          </div>
          <Pill design={design} ground="card" tone={widget.tone}>
            {widgetLabels[widget.tone]}
          </Pill>
          {compact ? null : (
            <Button aria-label="Delete" size="icon" variant="ghost">
              <IconTrash className="size-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/** The Studio top bar, where the pill sits next to a heading, on a card. */
function StudioBar({ design }: { design: Design }) {
  return (
    <div className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button aria-label="Back" size="icon" variant="ghost">
          <IconArrowLeft className="size-5" />
        </Button>
        <h3 className="type-heading min-w-0 truncate">Bakery homepage wall</h3>
        <Pill design={design} ground="card" tone="warning">
          Unpublished changes
        </Pill>
      </div>
      <Button size="sm">
        <IconSend className="size-4" />
        Publish changes
      </Button>
    </div>
  );
}

/** An Inbox row: the pill lands right after a name, on paper. */
function InboxRow({ design }: { design: Design }) {
  return (
    <div className="border-line divide-line bg-paper divide-y rounded-lg border">
      {[
        { name: "Claire Vasseur", role: "Founder · Northwind Bakery" },
        { name: "Tom Beaulieu", role: "Customer" },
      ].map((person, index) => (
        <div className="flex items-center gap-3 px-4 py-3" key={person.name}>
          <Avatar>
            <AvatarFallback>
              {person.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="type-ui truncate">{person.name}</p>
            <p className="type-small text-ink-2 truncate">{person.role}</p>
          </div>
          <Pill
            design={design}
            ground="paper"
            tone={index === 0 ? "success" : "info"}
          >
            {index === 0 ? "Published" : "Processing"}
          </Pill>
        </div>
      ))}
    </div>
  );
}

/** The three answers to "white on a white card". */
const flavors: ReadonlyArray<{
  design: Design;
  key: string;
  note: string;
  title: string;
}> = [
  {
    design: "chip-flat",
    key: "flat",
    note: "Chosen, and what ships. Pure white everywhere, nothing else: on paper the chip is a cut-out, and on a white card it melts into the card so only the dot and the word are left. The state is carried by the dot, not by a shape.",
    title: "C1 · Flat white — shipped",
  },
  {
    design: "chip-flip",
    key: "flip",
    note: "Weighed against it and dropped: white on paper, one warm step down on a white card, so the chip keeps a shape wherever it sits. It reads everywhere, at the price of a fill that is no longer white on the screens that matter most.",
    title: "C2 · White, flipped on cards",
  },
];

/** The four treatments the review started from, kept for the record. */
const treatments: ReadonlyArray<{ design: Design; title: string }> = [
  { design: "ink", title: "A · Ink" },
  { design: "tint", title: "B · Tint" },
  { design: "chip-flat", title: "C · Chip, white" },
  { design: "marker", title: "D · Marker" },
];

export function PillVariants() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">The chip, in white</h1>
            <p className="type-small text-ink-2">
              What white does on paper and on a white card. Development only.
            </p>
          </div>
          <ThemeToggle />
          <Button asChild size="sm" variant="outline">
            <Link href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-14 px-6 py-10">
        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">Where this stands</h2>
          <p className="type-body text-ink-2">
            The chip is picked: no border, fully round, one single fill for
            every state, and the color held in the 6px dot alone. The fill is
            now white — <code className="font-mono">--chip</code>, the same
            white as a card. That works on paper, and it raised one question:
            the Studio list and the Studio bar are white cards, so a white chip
            on them has nothing left to stand on. That is the answer:{" "}
            <strong className="font-semibold">nothing</strong>. No border, no
            lift — the chip melts into the card and the dot carries the state.
            It is what <code className="font-mono">Badge</code> now renders
            everywhere in the product.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="type-heading">On paper, then on a white card</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {flavors.map((flavor) => (
              <div className="space-y-3" key={flavor.key}>
                <div className="space-y-1">
                  <h3 className="type-ui font-semibold">{flavor.title}</h3>
                  <p className="type-small text-ink-2">{flavor.note}</p>
                </div>
                <div className="bg-paper border-line space-y-3 rounded-lg border p-4">
                  <p className="type-micro text-ink-3 uppercase">On paper</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill design={flavor.design} ground="paper" tone="success">
                      Published
                    </Pill>
                    <Pill design={flavor.design} ground="paper" tone="warning">
                      Pending
                    </Pill>
                    <Pill design={flavor.design} ground="paper" tone="danger">
                      Failed
                    </Pill>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="type-micro text-ink-3 uppercase">
                    On a white card
                  </p>
                  <StudioList compact design={flavor.design} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="type-heading">In the Studio bar</h2>
          <p className="type-body text-ink-2 max-w-prose">
            The one place a single pill carries the whole state of the screen,
            beside a 24px heading and an amber button.
          </p>
          <div className="space-y-4">
            {flavors.map((flavor) => (
              <div className="space-y-2" key={flavor.key}>
                <p className="type-micro text-ink-3 uppercase">
                  {flavor.title}
                </p>
                <StudioBar design={flavor.design} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="type-heading">The whole set, and the Inbox</h2>
          <p className="type-body text-ink-2 max-w-prose">
            The shipped flavor: every tag the product carries today, on paper,
            then two Inbox rows.
          </p>
          <div className="bg-paper border-line rounded-lg border p-5">
            <PillSet design="chip-flat" ground="paper" />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <InboxRow design="chip-flat" />
            <div className="bg-paper border-line rounded-lg border p-5">
              <p className="type-small text-ink-2">
                On paper the chip is a shape; on a white card it is a dot and a
                word. Two readings of the same component, and the list stays
                quiet either way.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t pt-8">
          <div className="max-w-prose space-y-1">
            <h2 className="type-heading">
              The four treatments, for the record
            </h2>
            <p className="type-body text-ink-2">
              Where the review started: the same two states in the four
              stroke-less treatments, and last, as they ship today.
            </p>
          </div>
          <div className="bg-line grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-5">
            {treatments.map((treatment) => (
              <div
                className="bg-paper flex flex-col items-start gap-3 p-5"
                key={treatment.title}
              >
                <p className="type-micro text-ink-3 uppercase">
                  {treatment.title}
                </p>
                <Pill design={treatment.design} ground="paper" tone="success">
                  Published
                </Pill>
                <Pill design={treatment.design} ground="paper" tone="warning">
                  Unpublished changes
                </Pill>
              </div>
            ))}
            <div className="bg-paper flex flex-col items-start gap-3 p-5">
              <p className="type-micro text-ink-3 uppercase">Today</p>
              <Badge dot variant="success">
                Published
              </Badge>
              <Badge dot variant="warning">
                Unpublished changes
              </Badge>
            </div>
          </div>
        </section>

        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">Once a flavor is picked</h2>
          <p className="type-body text-ink-2">
            It replaces the variants in{" "}
            <code className="font-mono">src/components/ui/badge.tsx</code>: one
            shell, the dot doing the work, and{" "}
            <code className="font-mono">brand</code> keeping its amber dot
            rather than its amber fill. DESIGN.md section 7 loses the sentence
            about the hairline on <code className="font-mono">--surface</code>,
            and section 5 already lists{" "}
            <code className="font-mono">--radius-full</code> for pills. This
            page is a scaffold and gets deleted with the branch.
          </p>
        </section>
      </main>
    </div>
  );
}
