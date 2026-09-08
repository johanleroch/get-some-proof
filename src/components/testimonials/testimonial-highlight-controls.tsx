"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { TRange } from "platejs";
import { useEditorRef, useEditorSelector } from "platejs/react";
import { IconHighlight, IconHighlightOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/** Shared subset used by the toolbar and keyboard shortcut. */
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

export function toggleHighlight(editor: Editor) {
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
export function HighlightPill({
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
    let frame: number | undefined;
    const schedulePlacement = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        place();
      });
    };
    document.addEventListener("selectionchange", schedulePlacement);
    window.addEventListener("resize", schedulePlacement);
    window.addEventListener("scroll", schedulePlacement, true);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", schedulePlacement);
      window.removeEventListener("resize", schedulePlacement);
      window.removeEventListener("scroll", schedulePlacement, true);
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
