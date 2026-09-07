"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  ANIMATED_VIEWBOX,
  blobAnimations,
  type BlobAnimation,
} from "@/lib/blob-animations";
import {
  blobBody,
  blobDefs,
  blobExpressions,
  type BlobExpression,
} from "@/lib/blob-expressions";
import { cn } from "@/lib/utils";

export type BlobExpressionName = BlobExpression["name"];

/** How long the eyes stay shut while the face swaps, in ms. */
const SWAP_AT = 150;
/** Full length of the blink transition, in ms. */
const TRANSITION = 380;

/**
 * The mascot with a face that never jumps: change `expression` and the blob
 * blinks, swaps the face while its eyes are shut, and reopens them with a
 * small settle of the body. Works between any two expressions, props and
 * sweat drop included. `idle` adds breathing and a periodic blink.
 */
export function Blob({
  className,
  expression = "neutral",
  idle = true,
  label,
  size = 160,
}: {
  className?: string;
  expression?: BlobExpressionName;
  idle?: boolean;
  label?: string;
  size?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [shown, setShown] = useState(expression);
  // A new target starts a new transition: derive it from the prop change
  // during render (the React pattern for state that follows props), so the
  // blink starts on this very render and the face swaps once the eyes shut.
  const [lastTarget, setLastTarget] = useState(expression);
  const [swapKey, setSwapKey] = useState(0);
  if (expression !== lastTarget) {
    setLastTarget(expression);
    setSwapKey((key) => key + 1);
  }
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (swapKey === 0) return;
    timer.current = window.setTimeout(() => {
      setShown(expression);
      timer.current = null;
    }, SWAP_AT);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [expression, swapKey]);

  const face =
    blobExpressions.find((candidate) => candidate.name === shown) ??
    blobExpressions[0];
  const scope = `#blob-${id}`;
  const idleCss = idle
    ? idleRules(scope, blobAnimations, face.blinks === true)
    : "";

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("inline-block shrink-0 leading-none", className)}
      role={label ? "img" : undefined}
      style={{ width: size, height: size }}
    >
      <svg
        fill="none"
        height={size}
        id={`blob-${id}`}
        overflow="visible"
        viewBox={ANIMATED_VIEWBOX}
        width={size}
      >
        <style>{`
${scope} .body, ${scope} .face-idle, ${scope} .face-swap { transform-box: fill-box; will-change: transform; }
${scope} .body { transform-origin: 50% 100%; }
${scope} .face-idle, ${scope} .face-swap { transform-origin: 50% 50%; }
${scope} .face-swap[data-swap] { animation: blob-swap ${TRANSITION}ms cubic-bezier(0.3, 0, 0.2, 1) both; }
${scope} .body[data-swap] { animation: blob-settle ${TRANSITION + 120}ms cubic-bezier(0.34, 1.3, 0.64, 1) both; }
@keyframes blob-swap {
  0% { transform: scaleY(1); }
  36% { transform: scaleY(0.08); }
  44% { transform: scaleY(0.08); }
  100% { transform: scaleY(1); }
}
@keyframes blob-settle {
  0% { transform: scale(1, 1); }
  40% { transform: scale(1.035, 0.975); }
  100% { transform: scale(1, 1); }
}
${scope} .drop, ${scope} .prop { transform-box: fill-box; transform-origin: 50% 100%; animation: blob-drop 760ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes blob-drop {
  0% { transform: translateY(-170px) scale(0.85); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
${idleCss}
@media (prefers-reduced-motion: reduce) {
  ${scope} .body, ${scope} .face-idle, ${scope} .face-swap, ${scope} .drop, ${scope} .prop { animation: none !important; }
}
`}</style>
        <g
          className="body"
          data-swap={swapKey || undefined}
          key={`body-${swapKey}`}
        >
          <g dangerouslySetInnerHTML={{ __html: blobBody(id) }} />
          <g className="face-idle">
            <g
              className="face-swap"
              dangerouslySetInnerHTML={{ __html: face.face }}
              data-swap={swapKey || undefined}
              key={`face-${swapKey}`}
            />
          </g>
        </g>
        <g dangerouslySetInnerHTML={{ __html: blobDefs(id) }} />
      </svg>
    </span>
  );
}

/**
 * Breathing on the body and, only when the shown face has open eyes, the
 * shared 4 s blink on the whole face.
 */
function idleRules(
  scope: string,
  animations: BlobAnimation[],
  blinks: boolean,
): string {
  const breathe = animations.find((animation) => animation.name === "breathe");
  const body = breathe
    ? breathe.css
        .replaceAll("$", scope)
        .split("\n")
        .filter((line) => !line.includes(".eye"))
        .join("\n")
    : "";
  if (!blinks) return body;
  return `${body}
${scope} .face-idle { animation: blob-idle-blink 4s cubic-bezier(0.4, 0, 0.2, 1) -1.7s infinite; }
@keyframes blob-idle-blink {
  0%, 91%, 97%, 100% { transform: scaleY(1); }
  94% { transform: scaleY(0.12); }
}`;
}
