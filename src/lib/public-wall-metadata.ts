import type { Metadata } from "next";

import { publicPageMetadata } from "./seo";

export function buildPublicWallMetadata(
  wall: {
    brandName: string;
    publicSlug: string;
    testimonialCount: number;
  },
  siteUrl: string,
): Metadata {
  const indexable = wall.testimonialCount > 0;
  return {
    ...publicPageMetadata({
      title: `${wall.brandName} testimonials`,
      description: `Customer testimonials published by ${wall.brandName}.`,
      path: new URL(
        `/w/${encodeURIComponent(wall.publicSlug)}`,
        siteUrl,
      ).toString(),
    }),
    robots: { follow: indexable, index: indexable },
  };
}
