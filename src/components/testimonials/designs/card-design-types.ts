import type { TestimonialCardValue } from "@convex/testimonialCardValue";

/**
 * What every card design is handed, and all it is handed: one Testimonial of
 * any kind and the Brand accent. A design that needs more than this is asking
 * the Owner to configure their proof, which the product does not do.
 */
export type CardDesignProps = {
  /** The Brand accent as a CSS colour; also on the surface as `--wall-accent`. */
  accentColor: string;
  testimonial: TestimonialCardValue;
};
