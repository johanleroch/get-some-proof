import type { ReactNode } from "react";

import { MarkerHighlight } from "@/components/doodles";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The grammar every landing section is written in. Three bands (paper, the
 * quiet `--surface-2`, the amber poster), one left-aligned heading block,
 * and a caption that says when what is shown is invented. Section rhythm is
 * `clamp(3rem, 8vw, 6rem)` and the column is 1280px wide (DESIGN.md
 * sections 5 and 6).
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
  /** `quiet` is `--surface-2`; `poster` is the amber tint, once per page. */
  tone?: "paper" | "poster" | "quiet";
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "scroll-mt-16 py-[clamp(3rem,8vw,6rem)]",
        tone === "quiet" && "bg-surface-2",
        tone === "poster" && "bg-brand-soft",
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

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("type-micro text-ink-2 uppercase", className)}>
      {children}
    </p>
  );
}

/** The page's one `h1`, the only title allowed to fill its column. */
export function PageTitle({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h1
      className={cn(
        "font-display text-ink text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-bold tracking-[-0.02em] text-balance",
        className,
      )}
      id={id}
    >
      {children}
    </h1>
  );
}

/**
 * A section title in Gelica. `statement` is the larger cut, for the one or
 * two moments the page raises its voice; everything else stays on the
 * regular step so the hierarchy keeps meaning.
 */
export function SectionTitle({
  as: Tag = "h2",
  children,
  className,
  id,
  size = "default",
}: {
  as?: "h2" | "h3";
  children: ReactNode;
  className?: string;
  id?: string;
  size?: "default" | "statement";
}) {
  return (
    <Tag
      className={cn(
        "font-display text-ink font-bold text-balance",
        size === "statement"
          ? "text-[clamp(2rem,3.8vw,3rem)] leading-[1.06] tracking-[-0.02em]"
          : "text-[clamp(1.625rem,2.6vw,2.25rem)] leading-[1.12] tracking-[-0.015em]",
        className,
      )}
      id={id}
    >
      {children}
    </Tag>
  );
}

/** The paragraph under a title: one measure, never wider than 60 characters. */
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
        "type-body text-ink-2 max-w-[58ch] sm:text-[17px] sm:leading-7",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** One key word carrying the marker swash, inline in a title. */
export function Highlighted({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <MarkerHighlight className="absolute inset-x-[-0.12em] bottom-[0.02em] h-[0.78em] w-[calc(100%+0.24em)]" />
      <span className="relative">{children}</span>
    </span>
  );
}

/**
 * What every block of proof on this page carries: nothing here belongs to a
 * customer of ours, and the page says so where the proof is, not only in the
 * small print (issue #181).
 */
export function DemoLine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "type-small text-ink-2 flex flex-wrap items-center gap-x-2 gap-y-1",
        className,
      )}
    >
      <Badge variant="neutral">Demo</Badge>
      <span>{children}</span>
    </p>
  );
}
