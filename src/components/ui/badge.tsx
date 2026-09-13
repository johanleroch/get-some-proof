import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Status chips (DESIGN.md section 7): one white chip for every state, fully
 * round, with neither border nor shadow. The status lives in its 6px dot
 * alone, never in a pastel fill and no longer in the label. On paper the chip
 * is a white cut-out; on a white card it melts into the card and the dot
 * carries the state on its own.
 */
const badgeVariants = cva(
  "bg-chip text-ink inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] leading-none font-medium tracking-[-0.004em] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      /** Each variant only picks the color of the dot. */
      variant: {
        brand: "[--chip-dot:var(--brand)]",
        danger: "[--chip-dot:var(--danger)]",
        info: "[--chip-dot:var(--info)]",
        neutral: "[--chip-dot:var(--ink-3)]",
        outline: "[--chip-dot:var(--ink-3)]",
        success: "[--chip-dot:var(--success)]",
        warning: "[--chip-dot:var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

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
     * Leading 6px dot in the status color. On by default everywhere the chip
     * carries a state; off for `outline`, the counter used on public walls,
     * where a dot would be decoration.
     */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";
  const resolvedVariant: NonNullable<BadgeVariant> = variant ?? "neutral";
  const showDot = dot ?? resolvedVariant !== "outline";

  return (
    <Comp
      data-slot="badge"
      data-variant={resolvedVariant}
      className={cn(
        badgeVariants({ variant: resolvedVariant }),
        showDot && !asChild && "pl-2",
        className,
      )}
      {...props}
    >
      {showDot && !asChild ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-(--chip-dot)"
        />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
