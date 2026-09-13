import type { Metadata } from "next";

import { publicPageMetadata } from "@/lib/seo";

import { CollectionFormShell } from "@/components/collection/collection-form-shell";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  ...publicPageMetadata({
    title: "Share your experience",
    description: "Share a text or video testimonial about your experience.",
  }),
};

export default async function CollectionFormPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const environment = getPublicEnvironment();
  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }
  const { publicSlug } = await params;
  return <CollectionFormShell publicSlug={publicSlug} />;
}
