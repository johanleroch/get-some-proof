import type { ReactNode } from "react";

import { MarkerHighlight } from "@/components/doodles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The pieces every landing section is built from: the band, the heading
 * block, and the frame a product demonstration sits in. Section rhythm is
 * `clamp(3rem, 8vw, 6rem)` (DESIGN.md section 5) and every heading block is
 * left-aligned with its eyebrow, never a centred column on a void.
 */

export function LandingSection({
  children,
  className,
  id,
  labelledBy,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
  /** `quiet` puts the section on `--surface-2`, full bleed. */
  tone?: "paper" | "quiet";
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "scroll-mt-16 py-[clamp(3rem,8vw,6rem)]",
        tone === "quiet" && "bg-surface-2",
        className,
      )}
      id={id}
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="type-micro text-ink-2 uppercase">{children}</p>;
}

/**
 * A section title in Gelica. `level` keeps the document outline honest while
 * the size stays the same: the hero is the page's only `h1`.
 */
export function SectionTitle({
  as: Tag = "h2",
  children,
  className,
  id,
}: {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      className={cn(
        "font-display text-ink text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.12] font-bold tracking-[-0.015em] text-balance",
        className,
      )}
      id={id}
    >
      {children}
    </Tag>
  );
}

/** The lead paragraph under a section title: one measure, never wider. */
export function SectionLead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "type-body text-ink-2 max-w-[60ch] sm:text-[17px] sm:leading-7",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** One word or phrase carrying the marker swash, inline in a title. */
export function Highlighted({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <MarkerHighlight className="absolute inset-x-[-0.12em] bottom-[0.02em] h-[0.78em] w-[calc(100%+0.24em)]" />
      <span className="relative">{children}</span>
    </span>
  );
}

/**
 * The frame every product demonstration sits in: a `--surface` panel with a
 * hairline, its own label, and the word Demo beside it. Nothing on this page
 * shows customer proof, so the label is part of the component, not a prop a
 * section can forget (issue #181: demonstration content must be
 * unmistakable).
 */
export function DemoFrame({
  caption,
  children,
  className,
  contentClassName,
  label,
}: {
  /** One `small` line under the frame: what the Owner chose here. */
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Where this Widget lives, in the demonstration's story. */
  label: ReactNode;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="border-line bg-surface overflow-hidden rounded-xl border">
        <div className="border-line flex items-center justify-between gap-3 border-b px-4 py-3">
          <span className="type-micro text-ink-2 truncate uppercase">
            {label}
          </span>
          <Badge variant="neutral">Demo</Badge>
        </div>
        <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
      </div>
      {caption ? (
        <figcaption className="type-small text-ink-2 mt-3">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
