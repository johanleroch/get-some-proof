import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { headers } from "next/headers";

import { publicWallResponse } from "@/lib/public-wall-server";
import {
  wallFromResponse,
  type PublicWallResponse,
} from "@/lib/public-wall-response";
import { PublicWallLive } from "@/components/public-wall/public-wall-live";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { buildPublicWallMetadata } from "@/lib/public-wall-metadata";

export const dynamic = "force-dynamic";

const getInitialWall = cache(async (publicSlug: string) => {
  // A local adapter call, not an HTTP fetch using a caller-controlled host.
  const requestHeaders = new Headers(await headers());
  requestHeaders.delete("if-none-match");
  const response = await publicWallResponse(
    new Request("https://public-wall.invalid/", { headers: requestHeaders }),
    { params: Promise.resolve({ publicSlug }) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public Wall temporarily unavailable.");
  return (await response.json()) as PublicWallResponse;
});

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
  const wall = await getInitialWall(publicSlug);
  if (!wall) {
    return { robots: { follow: false, index: false }, title: "Public Wall" };
  }
  return buildPublicWallMetadata(
    {
      brandName: wall.brand.name,
      publicSlug: wall.brand.publicSlug,
      testimonialCount: wall.testimonials.length,
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
  return (
    <PublicWallLive
      key={publicSlug}
      initialWall={wallFromResponse(wall)}
      initialCursor={wall.pagination.cursor}
      initialPrivacyRevision={wall.privacyRevision}
    />
  );
}
