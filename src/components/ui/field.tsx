import * as React from "react";

import { cn } from "@/lib/utils";

/** Label above, control, helper below, error below: the one form layout. */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("group/field grid gap-2", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-ink-2 text-[13px] leading-[1.125rem] tracking-[-0.004em]",
        className,
      )}
      {...props}
    />
  );
}

function FieldError({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn(
        "text-danger text-[13px] leading-[1.125rem] font-medium tracking-[-0.004em]",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export { Field, FieldDescription, FieldError };
