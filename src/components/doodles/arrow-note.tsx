import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SketchArrow } from "./marks";

/**
 * A handwritten caption with a curved arrow. Caption stays under six words.
 * `direction` is where the arrow points relative to the caption.
 */
export function ArrowNote({
  children,
  className,
  direction = "right",
  draw = false,
}: {
  children: ReactNode;
  className?: string;
  direction?: "left" | "right";
  draw?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-ink-2 inline-flex items-start gap-2",
        direction === "left" && "flex-row-reverse text-right",
        className,
      )}
    >
      <span className="type-hand pt-1">{children}</span>
      <SketchArrow
        className={cn("h-10 w-14", direction === "left" && "-scale-x-100")}
        draw={draw}
      />
    </span>
  );
}
