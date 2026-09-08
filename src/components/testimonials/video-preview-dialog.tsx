"use client";

import { defaultPrimaryColor } from "@convex/domain/brand";
import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { videoAspect } from "@/components/testimonials/testimonial-card-markup";

/**
 * A video Testimonial as it plays on the Public Wall, opened from its still
 * in the Inbox list. The card is the real one, so the Owner watches exactly
 * what a visitor would; a portrait video is capped by the viewport height so
 * the play button is never below the fold of the dialog.
 */
export function VideoPreviewDialog({
  accentColor = defaultPrimaryColor,
  onClose,
  submitterName,
  testimonial,
}: {
  accentColor?: string;
  onClose: () => void;
  submitterName: string;
  testimonial: TestimonialCardVideoValue;
}) {
  const [ratioWidth, ratioHeight] = videoAspect(testimonial.aspectRatio);
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{submitterName}&rsquo;s video</DialogTitle>
          <DialogDescription>
            The card exactly as it plays on your Public Wall.
          </DialogDescription>
        </DialogHeader>
        <div
          className="mx-auto w-full [&_[data-gsp-card]]:mb-0"
          style={{
            maxWidth: `calc((100svh - 14rem) * ${ratioWidth} / ${ratioHeight})`,
          }}
        >
          <TestimonialCard
            accentColor={accentColor}
            testimonial={testimonial}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
