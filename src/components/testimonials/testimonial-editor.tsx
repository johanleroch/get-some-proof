"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Value } from "platejs";
import { HighlightPlugin } from "@platejs/basic-nodes/react";
import {
  Plate,
  PlateContent,
  usePlateEditor,
  useEditorRef,
  useEditorSelector,
} from "platejs/react";
import { Highlighter } from "lucide-react";
import {
  richTextFromPlain,
  richTextToPlain,
  type TestimonialRichText,
} from "@convex/domain/testimonialRichText";
import { Button } from "@/components/ui/button";

function HighlightButton() {
  const editor = useEditorRef();
  const selected = useEditorSelector((editor) => editor.api.isExpanded(), []);
  const active = useEditorSelector(
    (editor) => Boolean(editor.api.marks()?.highlight),
    [],
  );
  return (
    <Button
      aria-label="Highlight selected text"
      aria-pressed={active}
      disabled={!selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        editor.tf.toggleMark("highlight");
        editor.tf.focus();
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Highlighter aria-hidden="true" /> Highlight
    </Button>
  );
}

export function TestimonialEditor({
  id,
  text,
  richText,
  onChange,
  formatOnly = false,
  autoFocus = false,
}: {
  id: string;
  text: string;
  richText?: TestimonialRichText;
  onChange: (text: string, richText: TestimonialRichText) => void;
  formatOnly?: boolean;
  autoFocus?: boolean;
}) {
  const editor = usePlateEditor({
    plugins: [HighlightPlugin],
    value: richText ?? richTextFromPlain(text),
  });
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
  return (
    <div className="border-input bg-background focus-within:ring-ring/40 overflow-hidden rounded-lg border focus-within:ring-2">
      <Plate editor={editor} onValueChange={persistValue}>
        <div className="border-b px-1 py-1">
          <HighlightButton />
        </div>
        <PlateContent
          aria-label="Your testimonial"
          className="min-h-40 px-3 py-3 text-sm leading-7 outline-none [&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:text-stone-900"
          data-step-focus
          id={id}
          placeholder="What changed for you?"
          onFocus={() => {
            if (!editor.selection && !formatOnly)
              editor.tf.focus({ at: [], edge: "end" });
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
      </Plate>
    </div>
  );
}
