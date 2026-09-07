import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] leading-none font-semibold tracking-[-0.004em] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        brand: "bg-brand-soft text-brand-text",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        neutral: "bg-surface-2 text-ink-2",
        outline: "border-line-2 text-ink border bg-transparent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  asChild = false,
  children,
  className,
  dot = false,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** Leading 6px status dot in the badge color. */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && !asChild ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
