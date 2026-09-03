import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { PublicWallLive } from "@/components/public-wall/public-wall-live";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { buildPublicWallMetadata } from "@/lib/public-wall-metadata";

export const dynamic = "force-dynamic";

async function getWallBrand(publicSlug: string) {
  return fetchQuery(api.publicWall.getBrand, { publicSlug });
}

async function getInitialWall(publicSlug: string) {
  const [brand, testimonials] = await Promise.all([
    getWallBrand(publicSlug),
    fetchQuery(api.publicWall.list, {
      paginationOpts: { cursor: null, numItems: 24 },
      publicSlug,
    }),
  ]);
  return brand ? { ...brand, testimonials: testimonials.page } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}): Promise<Metadata> {
  const environment = getPublicEnvironment();
  const { publicSlug } = await params;
  if (!environment.configured) {
    return { robots: { follow: false, index: false }, title: "Public Wall" };
  }
  const wall = await getWallBrand(publicSlug);
  if (!wall) {
    return { robots: { follow: false, index: false }, title: "Public Wall" };
  }
  return buildPublicWallMetadata(
    {
      brandName: wall.brandName,
      publicSlug: wall.publicSlug,
      testimonialCount: wall.hasPublishedTestimonials ? 1 : 0,
    },
    environment.siteUrl,
  );
}

export default async function PublicWallPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const environment = getPublicEnvironment();
  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }
  const { publicSlug } = await params;
  const wall = await getInitialWall(publicSlug);
  if (!wall) notFound();
  return <PublicWallLive initialWall={wall} />;
}
