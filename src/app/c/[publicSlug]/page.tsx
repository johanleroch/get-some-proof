import type { Metadata } from "next";

import { CollectionFormShell } from "@/components/collection/collection-form-shell";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Share your experience",
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
