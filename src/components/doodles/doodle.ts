import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type DoodleProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Keeps each object of the drawing on a slow, out-of-phase drift. */
  float?: boolean;
};

/**
 * Shared attributes for hand-drawn SVGs: decorative, current-color strokes,
 * round caps, and a stroke width that does not scale with the artwork.
 */
export function doodleProps(
  { className, float = false, ...props }: DoodleProps,
  viewBox: string,
) {
  return {
    "aria-hidden": true as const,
    className: cn("shrink-0", float && "doodle-float", className),
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox,
    xmlns: "http://www.w3.org/2000/svg",
    ...props,
  };
}

/** Shared per-stroke attribute: the width never scales with the artwork. */
export const strokeAttributes = {
  vectorEffect: "non-scaling-stroke" as const,
};
