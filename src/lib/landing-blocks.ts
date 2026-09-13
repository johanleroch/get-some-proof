import type { Route } from "next";

/**
 * The blocks the landing page is made of, in the order they appear at `/`.
 * The development page at `/kit/landing` renders each one live with its
 * note and its file, so a block can be judged on its own before the page is
 * judged as a whole. Device widths belong to `/screens`, which frames the
 * real page at the four artboard sizes.
 */
export type LandingBlock = {
  /** Anchor of the section on the public page. */
  anchor: Route;
  file: string;
  id: string;
  name: string;
  /** What the block has to do, and the rule it answers to. */
  note: string;
};

const file = (name: string) => `src/components/landing/${name}.tsx`;

export const landingBlocks: LandingBlock[] = [
  {
    anchor: "/",
    file: file("landing-hero"),
    id: "hero",
    name: "Hero",
    note: "Leads with the result: real Testimonial cards on the paper, laid out as a Wall with its columns offset, and the swash on one word of the title. The handwritten note says the wall is invented.",
  },
  {
    anchor: "/#why",
    file: file("landing-problem"),
    id: "problem",
    name: "The friction",
    note: "The page raises its voice once: the statement cut of the title, two paragraphs side by side, and the answer at heading. The envelope on its way is the region's one drawing.",
  },
  {
    anchor: "/#collect",
    file: file("landing-collection"),
    id: "collection",
    name: "Collection",
    note: "The real first step of the Collection Form, with its own two drawings. The visual leads and the words follow, the reverse of the block above it.",
  },
  {
    anchor: "/#selection",
    file: file("landing-selection"),
    id: "selection",
    name: "Two selections",
    note: "Two Widgets at 7:5, the second starting lower, each with its eyebrow and what its Owner chose. No automatic targeting is implied.",
  },
  {
    anchor: "/#publish",
    file: file("landing-studio"),
    id: "studio",
    name: "Presentation and installation",
    note: "The Studio's own controls beside its preview canvas — the same 24px grid — with the embed runtime a customer site loads rendering inside it.",
  },
  {
    anchor: "/#how-it-works",
    file: file("landing-steps"),
    id: "steps",
    name: "Three steps",
    note: "Rows, never three equal cards: the count at kpi in amber that reads on paper, the verb at heading, the sentence at the end of the row. The ring is the region's drawing.",
  },
  {
    anchor: "/#control",
    file: file("landing-capabilities"),
    id: "capabilities",
    name: "Control",
    note: "The page's one amber field, cut from the same poster as the sidebar plan card. Four rows with hairlines, no icon tiles.",
  },
  {
    anchor: "/#faq",
    file: file("landing-faq"),
    id: "faq",
    name: "Questions",
    note: "Every answer readable at once, in two columns under a full-width title, so the block does not repeat the split the others use.",
  },
  {
    anchor: "/",
    file: file("landing-cta"),
    id: "cta",
    name: "Closing poster",
    note: "The ink poster both public pages close on, with the starstruck mascot cropped by the panel (DESIGN.md section 4).",
  },
];
