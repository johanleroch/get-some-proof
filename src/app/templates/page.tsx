import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo";

import { TemplatesPage } from "@/components/templates/templates-page";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Testimonial templates",
    description:
      "Explore testimonial walls, sliders, spotlights and badges. Preview Get Some Proof layouts in your brand’s color.",
    path: "/templates",
  }),
  robots: { index: true, follow: true },
};

export default function TemplatesRoute() {
  return <TemplatesPage />;
}
