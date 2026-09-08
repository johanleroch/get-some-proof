import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TestimonialCardDesigns } from "@/components/kit/testimonial-card-designs";

export const metadata: Metadata = {
  title: "Testimonial card kit",
};

export default function TestimonialCardKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TestimonialCardDesigns />;
}
