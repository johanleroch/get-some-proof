"use client";

import * as React from "react";
import { IconCheck, IconMinus } from "@tabler/icons-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-line-2 bg-surface data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-ink focus-visible:ring-ring aria-invalid:border-danger aria-invalid:ring-danger/25 grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm border transition-[background-color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="animate-in zoom-in-50 grid place-items-center text-current duration-[var(--motion-base)] ease-[var(--ease-settle)]"
      >
        {props.checked === "indeterminate" ? (
          <IconMinus aria-hidden="true" className="size-3.5" stroke={3} />
        ) : (
          <IconCheck aria-hidden="true" className="size-3.5" stroke={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
