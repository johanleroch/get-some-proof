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
  illustration,
  title,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  action?: React.ReactNode;
  description?: React.ReactNode;
  illustration?: React.ReactNode;
  title: React.ReactNode;
}) {
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
          className="text-ink [&>svg]:h-auto [&>svg]:max-h-40 [&>svg]:w-auto"
        >
          {illustration}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h3 className="type-subheading">{title}</h3>
        {description ? (
          <p className="type-body text-ink-2 text-balance">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
