"use client";

import { useState } from "react";
import { ConvexError } from "convex/values";

import {
  type TestimonialRichText,
  richTextFromPlain,
} from "@convex/domain/testimonialRichText";
import { type TestimonialCardTextValue } from "@convex/testimonialCardValue";
import { defaultPrimaryColor } from "@convex/domain/brand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";

import { TestimonialEditor } from "./testimonial-editor";

function saveError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (
    error instanceof ConvexError &&
    typeof (error.data as { message?: unknown })?.message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return error instanceof Error
    ? error.message
    : "Could not save the highlight.";
}

/**
 * Marking one phrase of a Testimonial so it stands out on the public Wall.
 * The Owner never edits the words: the surface is locked and says so, the
 * toolbar states the act it is about to perform, and the card underneath is
 * the real published card, in the Brand's own colour, so what they judge is
 * what ships.
 */
export function HighlightTestimonialDialog({
  accentColor = defaultPrimaryColor,
  isPublished = false,
  onClose,
  onSave,
  submitterName,
  testimonial,
}: {
  accentColor?: string;
  /** A Published Testimonial changes on the public Wall the moment we save. */
  isPublished?: boolean;
  onClose: () => void;
  onSave: (richText: TestimonialRichText) => Promise<unknown>;
  submitterName: string;
  testimonial: TestimonialCardTextValue;
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
            These are your customer&apos;s words and they stay as written. You
            can only mark part of them.
          </DialogDescription>
        </DialogHeader>

        <TestimonialEditor
          accentColor={accentColor}
          disabled={saving}
          formatOnly
          id="highlight-testimonial"
          label={`Testimonial from ${submitterName}`}
          onChange={(_, content) => setRichText(content)}
          richText={richText}
          text={testimonial.text}
        />

        {isPublished ? (
          <p className="text-ink-2 type-small">
            This Testimonial is Published. Saving updates your Public Wall right
            away.
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="type-micro text-ink-2">On your Public Wall</p>
          <TestimonialCard
            accentColor={accentColor}
            testimonial={{ ...testimonial, richText }}
          />
        </div>

        {error ? (
          <p className="text-danger type-small" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="items-center">
          <p className="text-ink-2 type-small mr-auto">
            Cancel discards every mark you made here.
          </p>
          <Button disabled={saving} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              setError(undefined);
              try {
                await onSave(richText);
                onClose();
              } catch (error) {
                setError(saveError(error));
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
