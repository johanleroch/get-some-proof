import type { TestimonialCardValue } from "@convex/testimonialCardValue";

/**
 * What every template renders from. The accent is the customer Brand's own
 * color (never ours on a public surface, DESIGN.md section 2.5); the wall
 * theme and the `--wall-accent` variables are set by the surrounding
 * `TemplateStage`.
 */
export type TemplateRenderProps = {
  accentColor: string;
  brandName: string;
  testimonials: TestimonialCardValue[];
};
