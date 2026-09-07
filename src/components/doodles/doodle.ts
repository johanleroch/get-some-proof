import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type DoodleProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Draws the strokes in once on mount (600ms). Never loops. */
  draw?: boolean;
};

/**
 * Shared attributes for hand-drawn SVGs: decorative, current-color strokes,
 * round caps, and a stroke width that does not scale with the artwork.
 */
export function doodleProps(
  { className, draw = false, ...props }: DoodleProps,
  viewBox: string,
) {
  return {
    "aria-hidden": true as const,
    className: cn("shrink-0", draw && "doodle-draw", className),
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

export const strokeAttributes = {
  pathLength: 1,
  vectorEffect: "non-scaling-stroke" as const,
};
