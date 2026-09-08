"use client";

import { useState } from "react";

import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";
import { Button } from "@/components/ui/button";
import { VideoThumbnailDialog } from "@/components/testimonials/video-thumbnail-dialog";

/** Public Mux demo asset, the same one the Wall and Inbox fixtures play. */
const video: TestimonialCardVideoValue = {
  aspectRatio: "9:16",
  avatarUrl: null,
  captionsAvailable: true,
  company: "Tidewater Apps",
  id: "synthetic-video",
  name: "Maya Chen",
  playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
  posterTimeSeconds: 48,
  publishedAt: 0,
  rating: 5,
  role: "Product lead",
  type: "video",
};

/**
 * The thumbnail picker on a Published video, open on load with the Brand's
 * teal, for the `/screens` gallery and the visual-evidence captures. Saving
 * only closes it: there is no backend behind a fixture.
 */
export function VideoThumbnailScreenFixture() {
  const [open, setOpen] = useState(true);
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="type-heading">Change thumbnail</h1>
        <p className="text-ink-2 type-body mt-1">
          What the Owner sees from the Inbox on a video Testimonial.
        </p>
      </header>
      {open ? (
        <VideoThumbnailDialog
          accentColor="#0f766e"
          durationSeconds={96}
          isPublished
          onClose={() => setOpen(false)}
          onSave={async () => {}}
          submitterName="Maya Chen"
          testimonial={video}
        />
      ) : (
        <Button onClick={() => setOpen(true)}>Change thumbnail</Button>
      )}
    </section>
  );
}
