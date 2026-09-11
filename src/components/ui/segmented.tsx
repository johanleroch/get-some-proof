"use client";

import type { Icon } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export type Segment<T extends string> = {
  /** Optional: a choice can be its word alone. */
  icon?: Icon;
  key: T;
  label: string;
};

/**
 * A row of exclusive choices in a sunken track, the chosen one lifted onto
 * paper with a hairline. Used for preview widths and wall themes, wherever a
 * handful of options sit better on the surface than folded into a Select.
 */
export function Segmented<T extends string>({
  className,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  className?: string;
  /** Dims the whole track and takes every choice out of the tab order. */
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<Segment<T>>;
  value: T;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "bg-surface-2 inline-flex h-11 items-center gap-1 rounded-md p-1",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const active = option.key === value;
        const OptionIcon = option.icon;
        return (
          <button
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              "focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold tracking-[-0.008em] transition-[background-color,border-color,color] duration-150 outline-none focus-visible:ring-[3px]",
              active
                ? "bg-surface border-line text-ink"
                : "text-ink-2 hover:text-ink border-transparent",
              disabled && "cursor-not-allowed",
            )}
            key={option.key}
            onClick={() => onChange(option.key)}
            type="button"
          >
            {OptionIcon ? (
              <OptionIcon aria-hidden="true" className="size-4" />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
