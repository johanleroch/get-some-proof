import type { Id } from "@convex/_generated/dataModel";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";

/**
 * The forms a Customer can actually send, one sample each, for the card
 * designs page at `/kit/testimonials`. Every design is judged against the
 * same five, so a layout that only works on a tidy quote has nowhere to hide.
 *
 * The voices are the visual-evidence Brand (Fernhill Studio), so the review
 * page, the fixtures and the captures all tell the same story.
 *
 * To add a form: add an entry here. Every design renders it without being
 * touched, because a design takes a `TestimonialCardValue` and nothing else.
 */

/** Public Mux demo asset, also used by the visual-evidence fixtures. */
const samplePlaybackId = "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y";

/** A real face for the photo slot: a square crop of the same demo video. */
const sampleAvatarUrl = `https://image.mux.com/${samplePlaybackId}/thumbnail.webp?width=160&height=160&fit_mode=smartcrop&time=48`;

export type CardDesignSample = {
  key: string;
  /** Shown above the card, so it is clear which case is on trial. */
  label: string;
  /** What this form is there to catch. */
  note: string;
  testimonial: TestimonialCardValue;
};

export const cardDesignSamples: CardDesignSample[] = [
  {
    key: "text",
    label: "Text",
    note: "The common case: five stars, a role and a company.",
    testimonial: {
      avatarUrl: null,
      company: "Bellwether Coffee",
      id: "sample-text",
      name: "Alice Martin",
      publishedAt: Date.UTC(2026, 8, 3),
      rating: 5,
      role: "Founder",
      text: "Fernhill turned a folder of kind emails into proof we can actually show. Two new clients mentioned the wall on our first call.",
      type: "text",
    },
  },
  {
    key: "highlighted",
    label: "Highlighted phrase",
    note: "A marked phrase and a photo of the Customer: the swash takes the accent, the face takes the signature slot.",
    testimonial: {
      avatarUrl: sampleAvatarUrl,
      company: "Tidewater Apps",
      id: "sample-highlighted",
      name: "Priya Natarajan",
      publishedAt: Date.UTC(2026, 8, 2),
      rating: 5,
      richText: [
        {
          children: [
            { text: "The embed took " },
            { highlight: true, text: "one line" },
            {
              text: ". Our designer did not have to touch a thing, and it still looks like us.",
            },
          ],
          type: "p",
        },
      ],
      role: "Head of growth",
      text: "The embed took one line. Our designer did not have to touch a thing, and it still looks like us.",
      type: "text",
    },
  },
  {
    key: "photos",
    label: "With photos",
    note: "Up to three images ride under the quote; the card must not lose its footing.",
    testimonial: {
      avatarUrl: null,
      company: "North Star",
      id: "sample-photos",
      images: [
        {
          id: "sample-image-1" as Id<"testimonialImages">,
          url: "/brand/testimonial-sample.svg",
        },
      ],
      name: "Alex Morgan",
      publishedAt: Date.UTC(2026, 8, 1),
      rating: 5,
      role: "Founder",
      text: "We saved five hours every week. Our customers noticed the difference immediately.",
      type: "text",
    },
  },
  {
    key: "bare",
    label: "Name only",
    note: "Five stars and a name, no role, no company: the signature has to close cleanly on one line.",
    testimonial: {
      avatarUrl: null,
      id: "sample-bare",
      name: "Jordan Lee",
      publishedAt: Date.UTC(2026, 7, 30),
      rating: 5,
      text: "Our customers finished the form in two minutes. Nobody asked us what they were supposed to write.",
      type: "text",
    },
  },
  {
    key: "video",
    label: "Video",
    note: "The poster fills the card and the identity sits on the shade, whatever the design does with text.",
    testimonial: {
      aspectRatio: "9:16",
      avatarUrl: null,
      captionsAvailable: true,
      company: "Tidewater Apps",
      id: "sample-video",
      name: "Maya Chen",
      playbackId: samplePlaybackId,
      posterTimeSeconds: 48,
      publishedAt: Date.UTC(2026, 7, 28),
      rating: 5,
      role: "Product lead",
      type: "video",
    },
  },
];
