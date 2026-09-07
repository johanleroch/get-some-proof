import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tags on paper (DESIGN.md section 7): a `--line` hairline on `--surface`,
 * 6px radius. A status shows in its 6px dot and its label color, never in a
 * pastel fill. `brand` is the one tinted tag.
 */
const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] leading-none font-medium tracking-[-0.004em] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        brand: "bg-brand-soft border-brand-soft-2 text-ink",
        danger: "bg-surface border-line text-danger",
        info: "bg-surface border-line text-info",
        neutral: "bg-surface-2 text-ink-2 border-transparent",
        outline: "border-line-2 text-ink bg-transparent",
        success: "bg-surface border-line text-success",
        warning: "bg-surface border-line text-warning",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

const dotClass: Partial<Record<NonNullable<BadgeVariant>, string>> = {
  brand: "bg-brand",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-3",
  outline: "bg-ink-3",
  success: "bg-success",
  warning: "bg-warning",
};

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

function Badge({
  asChild = false,
  children,
  className,
  dot,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /**
     * Leading 6px dot in the status color. On by default for the four
     * statuses, since the dot is what carries them; off elsewhere.
     */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";
  const resolvedVariant = variant ?? "neutral";
  const showDot =
    dot ??
    (resolvedVariant === "success" ||
      resolvedVariant === "warning" ||
      resolvedVariant === "danger" ||
      resolvedVariant === "info");

  return (
    <Comp
      data-slot="badge"
      data-variant={resolvedVariant}
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {showDot && !asChild ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotClass[resolvedVariant])}
        />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
