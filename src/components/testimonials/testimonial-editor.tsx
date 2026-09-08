"use client";

import type { RefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { type TRange, type Value } from "platejs";
import { HighlightPlugin } from "@platejs/basic-nodes/react";
import {
  Plate,
  PlateContent,
  usePlateEditor,
  useEditorRef,
  useEditorSelector,
} from "platejs/react";
import { IconHighlight, IconHighlightOff } from "@tabler/icons-react";

import {
  richTextFromPlain,
  richTextToPlain,
  type TestimonialRichText,
} from "@convex/domain/testimonialRichText";
import { markerHighlightImage } from "@/lib/marker-highlight";
import { accentHighlight } from "@/lib/color-contrast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * In marking mode the words are the customer's and may never change
 * (docs/product-scope.md), so the surface is `readOnly`: immutable by
 * construction rather than by a rule that could be worked around. Two softer
 * approaches were tried and both let characters through, which is not a
 * trade worth making on someone else's words. `normalizeRichText` on the
 * server stays the backstop.
 */

/** What both call sites hand these helpers: the pill has the editor from
 * context, the shortcut has the one this component created. Only the parts
 * used here are named, so neither has to widen to the other. */
type Editor = {
  api: { isExpanded: () => boolean };
  children?: Leaf[];
  selection: { anchor: { path: number[] } } | null;
  tf: {
    focus: () => void;
    select: (at: TRange) => void;
    toggleMark: (key: string) => void;
  };
};
type Leaf = { children?: Leaf[]; highlight?: boolean; text?: string };

/**
 * The whole highlighted phrase under a collapsed caret. Removing a mark used
 * to mean re-selecting exactly the words that carried it; with this, clicking
 * anywhere inside a highlight offers to take it off.
 */
function highlightRun(editor: Editor) {
  const selection = editor.selection;
  if (!selection || editor.api.isExpanded()) return null;
  const path = selection.anchor.path;
  if (path.length < 2) return null;
  const blockPath = path.slice(0, -1);
  let block: Leaf | undefined = editor;
  for (const step of blockPath) block = block?.children?.[step];
  const children = block?.children;
  if (!children) return null;
  const index = path[path.length - 1];
  if (!children[index]?.highlight) return null;
  let start = index;
  while (start > 0 && children[start - 1]?.highlight) start -= 1;
  let end = index;
  while (end + 1 < children.length && children[end + 1]?.highlight) end += 1;
  return {
    anchor: { offset: 0, path: [...blockPath, start] },
    focus: {
      offset: (children[end].text ?? "").length,
      path: [...blockPath, end],
    },
  };
}

function toggleHighlight(editor: Editor) {
  const run = highlightRun(editor);
  // Selecting the run first turns a caret into the phrase it sits in, so the
  // same toggle serves both gestures.
  if (run) editor.tf.select(run);
  editor.tf.toggleMark("highlight");
  editor.tf.focus();
}

/**
 * The control comes to the words instead of the words going to a toolbar: a
 * pill at the bottom right of the selection, saying what it is about to do.
 * It also appears on a bare caret inside a mark, which is how a highlight is
 * taken off without hunting for its exact boundaries.
 */
function HighlightPill({
  boxRef,
  disabled,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
}) {
  const editor = useEditorRef();
  const expanded = useEditorSelector((editor) => editor.api.isExpanded(), []);
  const active = useEditorSelector(
    (editor) => Boolean(editor.api.marks()?.highlight),
    [],
  );
  const pillRef = useRef<HTMLDivElement>(null);
  const visible = expanded || active;

  // Written straight to the node, before paint: the pill follows a caret, so
  // a React render per pixel would be waste. It also keeps step with
  // scrolling, because the quote box scrolls inside the page.
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const box = boxRef.current;
      const pill = pillRef.current;
      const selection = window.getSelection();
      if (!box || !pill || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!box.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      const left = Math.max(
        0,
        Math.min(rect.right - frame.left, frame.width - pill.offsetWidth),
      );
      // Below the selection, as asked, unless the box has no room left for
      // it there: on a short quote that would hang the pill over the words,
      // and a click meant for the text would hit the button instead.
      const below = rect.bottom - frame.top + 8;
      const fits = below + pill.offsetHeight <= frame.height;
      const above = rect.top - frame.top - pill.offsetHeight - 8;
      pill.style.left = `${Math.round(left)}px`;
      pill.style.top = `${Math.round(fits || above < 0 ? below : above)}px`;
    };
    place();
    document.addEventListener("selectionchange", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("selectionchange", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [active, boxRef, expanded, visible]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20"
      ref={pillRef}
    >
      <Button
        aria-pressed={active}
        className="bg-surface shadow-float pointer-events-auto rounded-full"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggleHighlight(editor)}
        size="sm"
        type="button"
        variant="outline"
      >
        {active ? (
          <IconHighlightOff aria-hidden="true" />
        ) : (
          <IconHighlight aria-hidden="true" />
        )}
        {active ? "Remove highlight" : "Highlight"}
      </Button>
    </div>
  );
}

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
            onKeyDown={(event) => {
              // The pill answers the mouse; this answers the keyboard, which
              // cannot reach a control that follows a selection.
              if (
                (event.metaKey || event.ctrlKey) &&
                event.shiftKey &&
                event.key.toLowerCase() === "h"
              ) {
                event.preventDefault();
                toggleHighlight(editor);
              }
            }}
            readOnly={formatOnly}
            onPaste={
              formatOnly
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
