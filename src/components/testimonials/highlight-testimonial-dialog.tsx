"use client";
import { useState } from "react";
import {
  type TestimonialRichText,
  richTextFromPlain,
} from "@convex/domain/testimonialRichText";
import { type TestimonialCardTextValue } from "@convex/testimonialCardValue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TestimonialEditor } from "./testimonial-editor";

export function HighlightTestimonialDialog({
  testimonial,
  onClose,
  onSave,
}: {
  testimonial: TestimonialCardTextValue;
  onClose: () => void;
  onSave: (richText: TestimonialRichText) => Promise<unknown>;
}) {
  const [richText, setRichText] = useState(
    testimonial.richText ?? richTextFromPlain(testimonial.text),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Highlight a phrase</DialogTitle>
          <DialogDescription>
            Select the words you want to stand out.
          </DialogDescription>
        </DialogHeader>
        <TestimonialEditor
          formatOnly
          id="highlight-testimonial"
          text={testimonial.text}
          richText={richText}
          onChange={(_, content) => setRichText(content)}
        />
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={saving} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(undefined);
              try {
                await onSave(richText);
                onClose();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not save highlights.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
