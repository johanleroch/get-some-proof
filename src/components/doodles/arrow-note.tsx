import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SketchArrow } from "./marks";

/**
 * A handwritten caption with a sketched arrow. Caption stays under six words.
 * `direction` is where the arrow points relative to the caption. `arrow`
 * picks the stroke: `curve` dives down to something below the caption,
 * `flat` runs sideways to something on the same line.
 */
export function ArrowNote({
  arrow = "curve",
  children,
  className,
  direction = "right",
  draw = false,
}: {
  arrow?: "curve" | "flat";
  children: ReactNode;
  className?: string;
  direction?: "left" | "right";
  draw?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-ink-2 inline-flex gap-2",
        arrow === "flat" ? "items-center" : "items-start",
        direction === "left" && "flex-row-reverse text-right",
        className,
      )}
    >
      <span className={cn("type-hand", arrow === "curve" && "pt-1")}>
        {children}
      </span>
      <SketchArrow
        className={cn(
          arrow === "flat" ? "h-5 w-14" : "h-10 w-14",
          direction === "left" && "-scale-x-100",
        )}
        draw={draw}
        shape={arrow}
      />
    </span>
  );
}
