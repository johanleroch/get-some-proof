import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type DoodleProps = Omit<ComponentProps<"svg">, "children"> & {
  /** Draws the strokes in once on mount, object by object. Never loops. */
  draw?: boolean;
  /** Keeps each object of the drawing on a slow, out-of-phase drift. */
  float?: boolean;
};

/**
 * Shared attributes for hand-drawn SVGs: decorative, current-color strokes,
 * round caps, and a stroke width that does not scale with the artwork.
 */
export function doodleProps(
  { className, draw = false, float = false, ...props }: DoodleProps,
  viewBox: string,
) {
  return {
    "aria-hidden": true as const,
    className: cn(
      "shrink-0",
      draw && "doodle-draw",
      float && "doodle-float",
      className,
    ),
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

/**
 * Shared per-stroke attributes. The stroke width never scales with the
 * artwork; the draw-in dashes each stroke by its own `--draw-length`, baked
 * by `scripts/doodles/build.mjs`, because Chromium ignores `pathLength` on a
 * path that carries a non-scaling stroke.
 */
export const strokeAttributes = {
  vectorEffect: "non-scaling-stroke" as const,
};
