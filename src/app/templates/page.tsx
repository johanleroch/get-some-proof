import type { Metadata } from "next";

import { TemplatesPage } from "@/components/templates/templates-page";

export const metadata: Metadata = {
  description:
    "Walls, sliders, spotlights and compact badges: every layout Get Some Proof can give your testimonials, in your Brand's color.",
  title: "Testimonial templates",
};

export default function TemplatesRoute() {
  return <TemplatesPage />;
}
