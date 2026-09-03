import type { Metadata } from "next";

import { BrandPrivacyNotice } from "@/components/collection/brand-privacy-notice";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Testimonial privacy notice",
};

export default async function BrandPrivacyPage({
  params,
}: {
  params: Promise<{ publicSlug: string }>;
}) {
  const environment = getPublicEnvironment();
  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }
  const { publicSlug } = await params;
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12">
      <BrandPrivacyNotice publicSlug={publicSlug} />
    </main>
  );
}
