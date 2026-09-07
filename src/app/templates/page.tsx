import type { Metadata } from "next";

import { TemplatesPage } from "@/components/templates/templates-page";

export const metadata: Metadata = {
  description:
    "Walls, sliders, spotlights and compact badges: preview every design in your Brand's color. These layouts are previews, not yet available for your Wall.",
  title: "Testimonial templates",
};

export default function TemplatesRoute() {
  return <TemplatesPage />;
}
