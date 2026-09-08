import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TestimonialCardVariants } from "@/components/kit/testimonial-card-variants";

export const metadata: Metadata = {
  title: "Testimonial card kit",
};

export default function TestimonialCardKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TestimonialCardVariants />;
}
