import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Dashboard page header (DESIGN.md section 6): left-aligned eyebrow,
 * display title, one sentence, and at most one primary action on the right.
 */
export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
      data-slot="page-header"
    >
      <div className="max-w-prose min-w-0 space-y-1.5">
        {eyebrow ? <p className="type-micro text-ink-2">{eyebrow}</p> : null}
        <h1 className="type-display text-balance">{title}</h1>
        {description ? (
          <p className="type-body text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
