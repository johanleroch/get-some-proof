import { v, type Infer } from "convex/values";
export const imageIdsValidator = v.optional(v.array(v.id("testimonialImages")));
export const imageValueValidator = v.object({
  id: v.id("testimonialImages"),
  url: v.string(),
});
export type TestimonialImage = Infer<typeof imageValueValidator>;
export const maximumTestimonialImages = 3;
export const maximumTestimonialImageBytes = 5 * 1024 * 1024;
export const testimonialImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
