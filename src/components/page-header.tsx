import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Dashboard page header (DESIGN.md section 6): display title, one sentence,
 * and at most one primary action on the right.
 */
export function PageHeader({
  actions,
  className,
  description,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
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
        <h1 className="type-display text-balance">{title}</h1>
        {description ? (
          <p className="type-body text-ink-2">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
