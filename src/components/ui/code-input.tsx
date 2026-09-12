"use client";

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/**
 * One box per digit: the field says how long the code is before anything is
 * typed, and each digit lands in its own place.
 *
 * The boxes are the real inputs (a screen reader announces "digit 3 of 6"),
 * and a hidden input carries the whole code under `name`, so a surrounding
 * form reads it exactly like a single field.
 */
export function CodeInput({
  autoFocus,
  describedBy,
  disabled,
  id,
  invalid,
  labelledBy,
  length = 6,
  name,
  onComplete,
}: {
  autoFocus?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** Goes on the first box, so the field's label focuses it. */
  id: string;
  invalid?: boolean;
  /** The field's visible label: it names the group of boxes. */
  labelledBy?: string;
  length?: number;
  name: string;
  /** Called once the last digit lands, so a paste needs no second gesture. */
  onComplete?: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, () => ""),
  );
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const lastSent = useRef<string | null>(null);
  const code = digits.join("");

  useEffect(() => {
    if (code.length < length) {
      lastSent.current = null;
      return;
    }
    if (code === lastSent.current) return;
    lastSent.current = code;
    onComplete?.(code);
  }, [code, length, onComplete]);

  function focusBox(index: number) {
    const box = boxes.current[Math.min(Math.max(index, 0), length - 1)];
    box?.focus();
    box?.select();
  }

  /** Accepts one digit, or a whole code when a paste or autofill lands here. */
  function fillFrom(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    setDigits((current) => {
      const next = [...current];
      if (typed.length === 0) {
        next[index] = "";
        return next;
      }
      for (let offset = 0; offset < typed.length; offset += 1) {
        if (index + offset >= length) break;
        next[index + offset] = typed[offset];
      }
      return next;
    });
    if (typed.length > 0) focusBox(index + typed.length);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      // An empty box sends the backspace to the digit before it.
      event.preventDefault();
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
      focusBox(index - 1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusBox(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusBox(length - 1);
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/\d/.test(pasted)) return;
    // A box holds one character, so the browser would keep only the first.
    event.preventDefault();
    fillFrom(index, pasted);
  }

  return (
    <div
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className="flex w-full min-w-0 items-center gap-1.5 md:gap-2"
      role="group"
    >
      {digits.map((digit, index) => (
        <input
          aria-invalid={invalid || undefined}
          aria-label={`Digit ${index + 1} of ${length}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          className={cn(
            /* The boxes share the row rather than claiming a fixed width:
               on a narrow phone the last one would otherwise fall off the
               edge. They stop growing at 48px, the size they have on a
               desktop, and never fall under the 44px touch target. */
            "border-line-2 bg-surface text-ink h-14 max-w-12 min-w-0 flex-1 basis-0 rounded-md border text-center font-mono text-xl tabular-nums transition-[color,box-shadow,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out-soft)] outline-none",
            "focus-visible:border-brand focus-visible:ring-brand-ring focus-visible:ring-[3px]",
            "aria-invalid:border-danger aria-invalid:ring-danger/25",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            // A code reads in two halves, the way an app shows it.
            length % 2 === 0 && index === length / 2 && "ms-2",
          )}
          disabled={disabled}
          id={index === 0 ? id : undefined}
          inputMode="numeric"
          key={index}
          /* No `maxLength`: a fast typist can outrun the focus moving to the
             next box, and a capped box would silently drop those keystrokes.
             The extra characters arrive here instead and spill onward, and
             the controlled value trims the box back to one digit. */
          onChange={(event) => fillFrom(index, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          pattern="[0-9]*"
          ref={(node) => {
            boxes.current[index] = node;
          }}
          value={digit}
        />
      ))}
      <input name={name} type="hidden" value={code} />
    </div>
  );
}
