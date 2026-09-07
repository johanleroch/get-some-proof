import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Composed empty state: one illustration, a title, one sentence, one action.
 * Never a dashed box with a lone sentence.
 */
function EmptyState({
  action,
  className,
  description,
  headingLevel = 3,
  illustration,
  title,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  action?: React.ReactNode;
  description?: React.ReactNode;
  /** Heading level of the title; pick the one that fits the page outline. */
  headingLevel?: 1 | 2 | 3;
  illustration?: React.ReactNode;
  title: React.ReactNode;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <div
          aria-hidden="true"
          className="text-ink [&>svg]:max-h-40 [&>svg]:w-auto"
        >
          {illustration}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Heading className="type-subheading">{title}</Heading>
        {description ? (
          <p className="type-body text-ink-2 text-balance">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
