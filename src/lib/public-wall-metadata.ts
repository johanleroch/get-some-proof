import type { Metadata } from "next";

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
    alternates: {
      canonical: new URL(
        `/w/${encodeURIComponent(wall.publicSlug)}`,
        siteUrl,
      ).toString(),
    },
    description: `Customer testimonials published by ${wall.brandName}.`,
    robots: { follow: indexable, index: indexable },
    title: `${wall.brandName} testimonials`,
  };
}
