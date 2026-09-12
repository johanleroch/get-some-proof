import type { Id } from "@convex/_generated/dataModel";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";

/**
 * The review set for the widget families at `/kit/widgets`. Every family is
 * judged against these same nine, so a layout that only survives on tidy
 * two-line quotes has nowhere to hide: there is a long one, a bare one, a
 * marked one, two with photos and three videos.
 *
 * Voices are the visual-evidence Brands, same as the other review pages.
 */

/** Public Mux demo asset, shared with the visual-evidence fixtures. It was
 *  filmed portrait, so an entry that claims another shape has to carry a
 *  poster already framed that way: a layout must never be reviewed against a
 *  video whose declared ratio and picture disagree. */
const playbackId = "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y";
const face = (time: number) =>
  `https://image.mux.com/${playbackId}/thumbnail.webp?width=160&height=160&fit_mode=smartcrop&time=${time}`;
/** A landscape Testimonial, the one shape the demo asset cannot give on its own. */
const landscapePoster = `https://image.mux.com/${playbackId}/thumbnail.webp?width=960&height=540&fit_mode=smartcrop&time=30`;

export const galleryTestimonials: TestimonialCardValue[] = [
  {
    avatarUrl: face(48),
    company: "Tidewater Apps",
    id: "priya",
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
    source: { platform: "x", url: "https://x.com/example/status/1" },
    text: "The embed took one line. Our designer did not have to touch a thing, and it still looks like us.",
    type: "text",
  },
  {
    aspectRatio: "9:16",
    avatarUrl: null,
    captionsAvailable: true,
    company: "Tidewater Apps",
    id: "maya-chen",
    name: "Maya Chen",
    playbackId,
    posterTimeSeconds: 48,
    publishedAt: Date.UTC(2026, 7, 28),
    rating: 5,
    role: "Product lead",
    type: "video",
  },
  {
    avatarUrl: null,
    company: "Bellwether Coffee",
    id: "alice",
    name: "Alice Martin",
    publishedAt: Date.UTC(2026, 8, 3),
    rating: 5,
    role: "Founder",
    source: { platform: "google", url: "https://maps.google.com/example" },
    text: "Fernhill turned a folder of kind emails into proof we can actually show. Two new clients mentioned the wall on our first call.",
    type: "text",
  },
  {
    avatarUrl: null,
    id: "jordan",
    name: "Jordan Lee",
    publishedAt: Date.UTC(2026, 7, 30),
    rating: 5,
    text: "Our customers finished the form in two minutes. Nobody asked us what they were supposed to write.",
    type: "text",
  },
  {
    avatarUrl: face(12),
    company: "North Star",
    id: "alex",
    images: [
      {
        id: "gallery-image-1" as Id<"testimonialImages">,
        url: "/brand/testimonial-sample.svg",
      },
    ],
    name: "Alex Morgan",
    publishedAt: Date.UTC(2026, 8, 1),
    rating: 5,
    role: "Founder",
    source: { platform: "linkedin", url: "https://linkedin.com/example" },
    text: "We saved five hours every week. Our customers noticed the difference immediately.",
    type: "text",
  },
  {
    avatarUrl: null,
    company: "Cedar Workshop",
    id: "james",
    name: "James Carter",
    publishedAt: Date.UTC(2026, 7, 26),
    rating: 4,
    richText: [
      {
        children: [
          {
            text: "I kept putting this off for a year because I assumed collecting testimonials meant chasing people. ",
          },
          { highlight: true, text: "It took an afternoon" },
          {
            text: ". We sent one link after a job, and the words came back better than anything I would have written for us.",
          },
        ],
        type: "p",
      },
    ],
    role: "Owner",
    text: "I kept putting this off for a year because I assumed collecting testimonials meant chasing people. It took an afternoon. We sent one link after a job, and the words came back better than anything I would have written for us.",
    type: "text",
  },
  {
    aspectRatio: "16:9",
    avatarUrl: face(30),
    captionsAvailable: true,
    company: "RemyWeb Agency",
    id: "remy",
    name: "Remy Jupille",
    playbackId,
    posterTimeSeconds: 30,
    posterUrl: landscapePoster,
    publishedAt: Date.UTC(2026, 7, 24),
    rating: 5,
    role: "Founder",
    type: "video",
  },
  {
    avatarUrl: null,
    company: "Fernhill Studio",
    id: "sarah",
    name: "Sarah Reed",
    publishedAt: Date.UTC(2026, 7, 22),
    rating: 5,
    richText: [
      {
        children: [
          { text: "A small detail that made our website " },
          { highlight: true, text: "feel much more human" },
          {
            text: ". I love being able to choose the words our customers already use.",
          },
        ],
        type: "p",
      },
    ],
    role: "Designer",
    source: { platform: "instagram", url: "https://instagram.com/example" },
    text: "A small detail that made our website feel much more human. I love being able to choose the words our customers already use.",
    type: "text",
  },
  {
    aspectRatio: "9:16",
    avatarUrl: null,
    captionsAvailable: false,
    company: "Field Notes",
    id: "elena",
    name: "Elena Duarte",
    playbackId,
    posterTimeSeconds: 62,
    publishedAt: Date.UTC(2026, 7, 20),
    rating: 5,
    role: "Studio manager",
    type: "video",
  },
];
