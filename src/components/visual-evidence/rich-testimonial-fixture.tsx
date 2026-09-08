"use client";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { TestimonialCardTextValue } from "@convex/testimonialCardValue";
import { TestimonialEditor } from "@/components/testimonials/testimonial-editor";
import { TestimonialImagesInput } from "@/components/testimonials/testimonial-images-input";
import { HighlightTestimonialDialog } from "@/components/testimonials/highlight-testimonial-dialog";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { Button } from "@/components/ui/button";
const initial: TestimonialCardTextValue = {
  id: "synthetic-testimonial",
  name: "Alex Morgan",
  role: "Founder",
  company: "North Star",
  avatarUrl: null,
  publishedAt: 0,
  rating: 5,
  type: "text",
  text: "We saved five hours every week. Our customers noticed the difference immediately.",
  richText: [
    {
      type: "p",
      children: [
        { text: "We saved " },
        { text: "five hours every week", highlight: true },
        { text: ". Our customers noticed the difference immediately." },
      ],
    },
  ],
  images: [
    {
      id: "synthetic-image" as Id<"testimonialImages">,
      url: "/brand/testimonial-sample.svg",
    },
  ],
};
export function RichTestimonialScreenFixture() {
  const [card, setCard] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState(initial.images ?? []);
  const [formatting, setFormatting] = useState(false);
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your testimonial</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tell your story. Highlight what matters.
        </p>
      </header>
      <TestimonialEditor
        id="rich-testimonial"
        text={card.text}
        richText={card.richText}
        onChange={(text, richText) => setCard({ ...card, text, richText })}
      />
      <TestimonialImagesInput
        files={files}
        onFilesChange={setFiles}
        images={images}
        onImagesChange={setImages}
      />
      <div>
        <p className="text-muted-foreground mb-3 text-xs">Preview</p>
        <TestimonialCard
          accentColor="#7c3aed"
          testimonial={{ ...card, images }}
        />
      </div>
      <Button onClick={() => setFormatting(true)} variant="outline">
        Highlight a phrase
      </Button>
      {formatting ? (
        <HighlightTestimonialDialog
          accentColor={"#0f766e"}
          submitterName="Alice Martin"
          testimonial={card}
          onClose={() => setFormatting(false)}
          onSave={async (richText) => setCard({ ...card, richText })}
        />
      ) : null}
    </section>
  );
}
