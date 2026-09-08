"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Value } from "platejs";
import { HighlightPlugin } from "@platejs/basic-nodes/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";

import {
  richTextFromPlain,
  richTextToPlain,
  type TestimonialRichText,
} from "@convex/domain/testimonialRichText";
import { markerHighlightImage } from "@/lib/marker-highlight";
import { accentHighlight } from "@/lib/color-contrast";
import { cn } from "@/lib/utils";
import {
  HighlightPill,
  toggleHighlight,
} from "./testimonial-highlight-controls";

export function TestimonialEditor({
  accentColor,
  autoFocus = false,
  disabled = false,
  formatOnly = false,
  id,
  label = "Your testimonial",
  onChange,
  richText,
  text,
}: {
  /** Customer Brand accent, so a mark previews in the colour it ships in. */
  accentColor?: string;
  autoFocus?: boolean;
  /** Freezes the surface while a save is in flight. */
  disabled?: boolean;
  /** Marking mode: the words are locked, only highlights change. */
  formatOnly?: boolean;
  id: string;
  label?: string;
  onChange: (text: string, richText: TestimonialRichText) => void;
  richText?: TestimonialRichText;
  text: string;
}) {
  const editor = usePlateEditor({
    plugins: [HighlightPlugin],
    value: richText ?? richTextFromPlain(text),
  });
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() =>
      editor.tf.focus({ at: [], edge: "end" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, editor]);
  const onChangeRef = useRef(onChange);
  const lastValue = useRef(JSON.stringify(richText ?? richTextFromPlain(text)));
  const mounted = useRef(false);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const persistValue = useCallback(({ value }: { value: Value }) => {
    const content = value.map((block) => ({
      type: "p" as const,
      children: block.children.map((leaf) => ({
        text: typeof leaf.text === "string" ? leaf.text : "",
        ...(leaf.highlight ? { highlight: true } : {}),
      })),
    }));
    const serialized = JSON.stringify(content);
    if (serialized === lastValue.current) return;
    lastValue.current = serialized;
    // Plate may normalize during mount. Notify the parent after that update.
    queueMicrotask(() => {
      if (mounted.current)
        onChangeRef.current(richTextToPlain(content), content);
    });
  }, []);
  const markerStyle = useMemo(
    () =>
      accentColor
        ? ({
            "--marker-image": markerHighlightImage(
              accentHighlight(accentColor),
            ),
          } as React.CSSProperties)
        : undefined,
    [accentColor],
  );

  return (
    <Plate editor={editor} onValueChange={persistValue}>
      {/* The pill sits outside the clipped box so it can hang below the last
          line, and inside this wrapper so it stays within the dialog it
          belongs to rather than escaping to the document. */}
      <div
        className={cn("relative", disabled && "pointer-events-none opacity-70")}
        ref={boxRef}
        onKeyDownCapture={(event) => {
          const highlightShortcut =
            (event.metaKey || event.ctrlKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "h";
          if (highlightShortcut) {
            event.preventDefault();
            event.stopPropagation();
            if (!disabled) toggleHighlight(editor);
          } else if (
            (formatOnly || disabled) &&
            (event.key === "Backspace" || event.key === "Delete")
          ) {
            // Backspace navigates back in WebKit when the quote is read-only.
            event.preventDefault();
          }
        }}
      >
        <div
          className={cn(
            "phrase-marker overflow-hidden",
            // Marking mode reads as the quote it is, not as a field to fill.
            formatOnly
              ? "border-line bg-surface rounded-lg border"
              : "border-input bg-background focus-within:ring-ring/40 rounded-lg border focus-within:ring-2",
          )}
          style={markerStyle}
        >
          <div
            className={cn(
              "border-b",
              formatOnly ? "bg-surface-2/60 px-2 py-1" : "px-1 py-1",
            )}
          >
            <p className="text-ink-2 type-small px-1 py-1.5">
              Select a few words in the quote below.
            </p>
          </div>
          <PlateContent
            aria-label={label}
            className={cn(
              "[scrollbar-gutter:stable] overflow-y-auto overscroll-contain outline-none",
              formatOnly
                ? "max-h-56 px-5 py-5 text-[15px] leading-7"
                : "h-40 px-3 py-3 text-sm leading-7",
            )}
            data-step-focus
            id={id}
            placeholder={formatOnly ? undefined : "What changed for you?"}
            onFocus={() => {
              if (!editor.selection && !formatOnly)
                editor.tf.focus({ at: [], edge: "end" });
            }}
            aria-readonly={formatOnly || disabled}
            readOnly={formatOnly || disabled}
            tabIndex={formatOnly ? 0 : undefined}
            onPaste={
              formatOnly || disabled
                ? undefined
                : (event) => {
                    event.preventDefault();
                    editor.tf.insertFragment(
                      richTextFromPlain(
                        event.clipboardData
                          .getData("text/plain")
                          .replace(/\r\n?/g, "\n"),
                      ),
                    );
                    return true;
                  }
            }
          />
        </div>
        <HighlightPill boxRef={boxRef} disabled={disabled} />
      </div>
    </Plate>
  );
}
