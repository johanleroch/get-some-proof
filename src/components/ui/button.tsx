import * as React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-semibold tracking-[-0.008em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,translate] duration-150 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none aria-pressed:bg-brand-soft aria-pressed:text-ink aria-invalid:border-danger aria-invalid:ring-danger/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-ink hover:bg-brand-strong",
        destructive:
          "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40",
        outline: "border-line-2 bg-surface text-ink border hover:bg-surface-2",
        secondary: "bg-surface-2 text-ink hover:bg-accent",
        ghost: "text-ink hover:bg-surface-2",
        link: "text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 has-[svg:not([data-slot=button-spinner])]:px-3",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs has-[svg:not([data-slot=button-spinner])]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 px-3 has-[svg:not([data-slot=button-spinner])]:px-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 px-6 text-[15px] has-[svg:not([data-slot=button-spinner])]:px-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner over a still-visible-width label and blocks input. */
    loading?: boolean;
  };

function Button({
  asChild = false,
  children,
  className,
  disabled,
  loading = false,
  size = "default",
  variant = "default",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const showSpinner = loading && !asChild;

  return (
    <Comp
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      data-loading={loading || undefined}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      disabled={disabled || loading}
      {...props}
    >
      {showSpinner ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center"
          >
            <IconLoader2
              data-slot="button-spinner"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          </span>
          <span className="inline-flex items-center gap-[inherit] opacity-0">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
