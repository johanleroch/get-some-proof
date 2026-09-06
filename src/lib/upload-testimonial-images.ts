import type { TestimonialImage } from "@convex/domain/testimonialImage";

export async function uploadTestimonialImages(
  files: File[],
  upload?: (file: File) => Promise<TestimonialImage>,
) {
  if (!files.length) return [];
  if (!upload) throw new Error("Image uploads are unavailable.");
  return Promise.all(files.map(upload));
}
