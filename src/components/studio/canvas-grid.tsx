"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/**
 * The square the Studio canvas is ruled with (DESIGN.md section 6). Big enough
 * to read as a work surface: at the 24px rhythm of the rest of the interface
 * the canvas looked like graph paper.
 */
const CELL = 56;
/**
 * Each cell waits this long per cell of distance from the one that was hit,
 * and a far cell also fades more slowly, so the wave loses speed as it goes.
 * Aceternity's own 55ms and 80ms per cell ran for over three seconds on a
 * canvas this size; these are scaled to our motion vocabulary, where the whole
 * wave lands inside a second.
 */
const DELAY_PER_CELL = 22;
const DURATION_BASE = 180;
const DURATION_PER_CELL = 14;
/** Past this the wave has left the canvas; farther cells never animate. */
const MAX_DISTANCE = 22;

type Ripple = { column: number; row: number; id: number };

/**
 * The editor's work surface: real cells rather than a painted background, so
 * the canvas answers the pointer. A cell lightens under the cursor, and a click
 * sends a circular wave out from it, each ring later and slower than the one
 * inside it.
 *
 * Adapted from Aceternity's background ripple effect to our own tokens: the
 * tiles keep the canvas tone on `--line-2` hairlines so the white widget still
 * separates from them, and the wave carries the brand amber instead of raising
 * grey. Only opacity animates, the wave plays once,
 * the grid sits behind the widget and never takes a click meant for it, and it
 * holds still under reduced motion.
 */
export function CanvasGrid({
  alignTo,
  className,
  inset = 0,
}: {
  /**
   * An element whose top left corner a grid line should pass through, so the
   * page sheet sits on the grid instead of floating over it. The grid shifts
   * its own phase rather than moving the sheet, which stays centred.
   */
  alignTo?: RefObject<HTMLElement | null>;
  className?: string;
  /**
   * Gap to leave between the aligned element's edge and the grid line, so the
   * sheet sits just inside its cell rather than glued to the rule.
   */
  inset?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ columns: 0, rows: 0 });
  const [phase, setPhase] = useState({ x: 0, y: 0 });
  const [ripple, setRipple] = useState<Ripple | null>(null);

  // The canvas scrolls, so the grid is as tall as everything in it rather than
  // as tall as the window on it: measure the scroller, not the painted box.
  useEffect(() => {
    const element = frame.current;
    const scroller = element?.parentElement;
    if (!element || !scroller || typeof ResizeObserver === "undefined") return;
    function measure() {
      if (!scroller || !element) return;
      // One extra row and column, because the grid can be shifted by up to a
      // whole cell to line up with the sheet.
      setSize({
        columns: Math.ceil(scroller.clientWidth / CELL) + 1,
        rows:
          Math.ceil(
            Math.max(scroller.clientHeight, scroller.scrollHeight) / CELL,
          ) + 1,
      });
      const target = alignTo?.current;
      if (!target) {
        setPhase({ x: 0, y: 0 });
        return;
      }
      const origin = element.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      setPhase({
        x: ((box.left - origin.left - inset) % CELL) - CELL,
        y: ((box.top - origin.top - inset) % CELL) - CELL,
      });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) {
      if (child !== element) observer.observe(child);
    }
    if (alignTo?.current) observer.observe(alignTo.current);
    measure();
    return () => observer.disconnect();
  }, [alignTo, inset]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setRipple({
      column: Math.floor((event.clientX - bounds.left - phase.x) / CELL),
      id: Date.now(),
      row: Math.floor((event.clientY - bounds.top - phase.y) / CELL),
    });
  }

  const cells = size.columns * size.rows;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "canvas-grid absolute inset-x-0 top-0 overflow-hidden",
        className,
      )}
      data-slot="canvas-grid"
      onPointerDown={onPointerDown}
      ref={frame}
    >
      <div
        className="grid w-full"
        key={ripple?.id ?? "still"}
        style={{
          gridTemplateColumns: `repeat(${size.columns}, ${CELL}px)`,
          gridTemplateRows: `repeat(${size.rows}, ${CELL}px)`,
          transform: `translate(${phase.x}px, ${phase.y}px)`,
        }}
      >
        {Array.from({ length: cells }, (_, index) => {
          const column = index % size.columns;
          const row = Math.floor(index / size.columns);
          const distance = ripple
            ? Math.hypot(ripple.column - column, ripple.row - row)
            : null;
          const waving = distance !== null && distance <= MAX_DISTANCE;
          return (
            <div
              className={cn("canvas-grid-cell", waving && "canvas-grid-wave")}
              key={index}
              style={
                waving
                  ? ({
                      "--cell-delay": `${Math.round(distance * DELAY_PER_CELL)}ms`,
                      "--cell-duration": `${Math.round(
                        DURATION_BASE + distance * DURATION_PER_CELL,
                      )}ms`,
                    } as CSSProperties)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
