import { v, type Infer } from "convex/values";
export const imageIdsValidator = v.optional(v.array(v.id("testimonialImages")));
export const imageValueValidator = v.object({
  id: v.id("testimonialImages"),
  url: v.string(),
});
export type TestimonialImage = Infer<typeof imageValueValidator>;
export const maximumTestimonialImages = 3;
export const maximumTestimonialImageBytes = 1024 * 1024;
export const maximumTestimonialImageInputBytes = 20 * 1024 * 1024;
export const testimonialImageMimeTypes = ["image/webp"];
export const testimonialImageInputMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];
