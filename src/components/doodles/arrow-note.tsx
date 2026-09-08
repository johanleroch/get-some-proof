import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SketchArrow } from "./marks";

/**
 * A handwritten caption with a sketched arrow. Caption stays under six words.
 * `direction` is where the arrow points relative to the caption. `arrow`
 * picks the stroke: `curve` dives down to something below the caption,
 * `flat` runs sideways to something on the same line, `rise` climbs to
 * something above it. `size` shrinks the stroke where the note is a margin
 * remark rather than a signpost.
 */
export function ArrowNote({
  arrow = "curve",
  children,
  className,
  direction = "right",
  size = "md",
}: {
  arrow?: "curve" | "flat" | "rise";
  children: ReactNode;
  className?: string;
  direction?: "left" | "right";
  size?: "md" | "sm";
}) {
  return (
    <span
      className={cn(
        "text-ink-2 inline-flex",
        size === "sm" ? "gap-1.5" : "gap-2",
        arrow === "flat"
          ? "items-center"
          : arrow === "rise"
            ? "items-end"
            : "items-start",
        direction === "left" && "flex-row-reverse text-right",
        className,
      )}
    >
      <span className="type-hand">{children}</span>
      {arrow === "rise" ? (
        /* The curve turned upside down, so it leaves the caption's middle
           line and climbs. It is out of flow: a spacer keeps its width and
           the note's height is the caption's alone, so whatever stands
           beside it keeps its rhythm. The start sits 6px (4px small) above
           the box's bottom edge. */
        <span
          className={cn("relative shrink-0", size === "sm" ? "w-10" : "w-14")}
        >
          <SketchArrow
            className={cn(
              "absolute left-0 -scale-y-100",
              size === "sm"
                ? "bottom-[calc(var(--type-hand-leading)/2-4px)] h-7 w-10"
                : "bottom-[calc(var(--type-hand-leading)/2-6px)] h-10 w-14",
              direction === "left" && "-scale-x-100",
            )}
            shape="curve"
          />
        </span>
      ) : (
        /* The curve starts 5px below the top of its 40px box: offset it so
           that start sits on the caption's middle line before diving down. */
        <SketchArrow
          className={cn(
            arrow === "flat"
              ? size === "sm"
                ? "h-4 w-10"
                : "h-5 w-14"
              : size === "sm"
                ? "mt-[calc(var(--type-hand-leading)/2-4px)] h-7 w-10"
                : "mt-[calc(var(--type-hand-leading)/2-5px)] h-10 w-14",
            direction === "left" && "-scale-x-100",
          )}
          shape={arrow}
        />
      )}
    </span>
  );
}
