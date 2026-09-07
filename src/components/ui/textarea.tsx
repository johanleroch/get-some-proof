import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "border-input bg-surface text-ink placeholder:text-ink-3 selection:bg-brand-soft-2 selection:text-ink flex field-sizing-content min-h-24 w-full rounded-md border px-3 py-2 text-base tracking-[-0.008em] transition-[color,box-shadow,border-color] duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-brand focus-visible:ring-ring focus-visible:ring-[3px]",
        "aria-invalid:border-danger aria-invalid:ring-danger/25",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
