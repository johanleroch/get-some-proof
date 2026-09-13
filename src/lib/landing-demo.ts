import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import type { WidgetConfig } from "@convex/domain/widgets";
import { defaultAccent } from "@/lib/templates-catalog";

/**
 * Demonstration content for the public landing page.
 *
 * Nothing here is a customer of Get Some Proof: it is one fictional Brand
 * (the same Fernhill Studio the visual-evidence fixtures use) talking about
 * its own work, so a visitor never reads these cards as our endorsements.
 * Every surface that renders them carries the `DemoLabel` beside it, and the
 * page repeats the disclosure in its footer. Authorized customer proof
 * replaces this set without touching the layouts (see the asset inventory in
 * `docs/design/landing-page/DESIGN.md`).
 */

export const demoBrandName = "Fernhill Studio";

/** Public Mux demo asset, the one the fixtures and the template samples use. */
const demoPlaybackId = "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y";

export const demoDisclosure =
  "Testimonials on this page are demonstration content from a fictional studio, not Get Some Proof customers.";

const remy: TestimonialCardValue = {
  aspectRatio: "9:16",
  avatarUrl: null,
  captionsAvailable: true,
  company: "Bellwether Coffee",
  id: "demo-video-remy",
  name: "Remy Jupille",
  playbackId: demoPlaybackId,
  posterTimeSeconds: 40,
  publishedAt: Date.UTC(2026, 8, 4),
  rating: 5,
  role: "Founder",
  type: "video",
};

const alice: TestimonialCardValue = {
  avatarUrl: null,
  company: "Bellwether Coffee",
  id: "demo-text-alice",
  name: "Alice Martin",
  publishedAt: Date.UTC(2026, 8, 3),
  rating: 5,
  role: "Owner",
  text: "They redrew our menu boards and the whole counter feels calmer. Regulars find the specials without asking now.",
  type: "text",
};

const tomas: TestimonialCardValue = {
  avatarUrl: null,
  company: "Herrera & Sons Plumbing",
  id: "demo-text-tomas",
  name: "Tomás Herrera",
  publishedAt: Date.UTC(2026, 7, 27),
  rating: 5,
  role: "Owner",
  text: "They listened first and drew second. The van, the invoices and the website finally look like the same company.",
  type: "text",
};

const chloe: TestimonialCardValue = {
  avatarUrl: null,
  id: "demo-text-chloe",
  name: "Chloé Bernard",
  publishedAt: Date.UTC(2026, 7, 25),
  rating: 5,
  role: "Career coach",
  text: "I arrived with a folder of half-ideas. I left with a site I can update myself between clients.",
  type: "text",
};

const hannah: TestimonialCardValue = {
  avatarUrl: null,
  company: "Lantern Books",
  id: "demo-text-hannah",
  name: "Hannah Weiss",
  publishedAt: Date.UTC(2026, 7, 20),
  rating: 5,
  role: "Founder",
  text: "Two rounds, no drama, and the shop page reads the way we talk in person.",
  type: "text",
};

const sam: TestimonialCardValue = {
  avatarUrl: null,
  company: "Signal Works",
  id: "demo-text-sam",
  name: "Sam Okafor",
  publishedAt: Date.UTC(2026, 7, 22),
  rating: 4,
  role: "Product designer",
  text: "The brand guide is short enough that our team actually opens it.",
  type: "text",
};

/** Hero: one video and two written pieces, the mix a fresh Wall shows. */
export const demoHeroTestimonials: TestimonialCardValue[] = [
  remy,
  alice,
  tomas,
];

/**
 * Section 4, left panel: what the homepage Widget was given. Written proof
 * only, so the section shows a difference in selection rather than a
 * difference in format, and so the one demonstration video stays the one
 * whose name matches the person recorded in it.
 */
export const demoHomepageSelection: TestimonialCardValue[] = [
  chloe,
  alice,
  sam,
];

/** Section 4, right panel: a different Widget, a different selection. */
export const demoPricingSelection: TestimonialCardValue[] = [hannah, tomas];

/** Section 5: the selection the Studio demonstration renders. */
export const demoStudioTestimonials: TestimonialCardValue[] = [
  remy,
  alice,
  chloe,
  hannah,
];

export const demoWidgetConfig: WidgetConfig = {
  accentColor: defaultAccent,
  backgroundColor: "#ffffff",
  font: "inherit",
  layout: "masonry",
  textColor: "#2e2a25",
};

/** The snippet the Studio hands an Owner, with a demonstration identifier. */
export function demoEmbedSnippet(origin = "https://www.getsomeproof.com") {
  return `<div data-gsp-widget="demo-widget"></div>\n<script src="${origin}/embed/v2.js" async></script>`;
}
