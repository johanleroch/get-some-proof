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
    <main className="bg-paper grid min-h-svh place-items-center px-5 py-10 sm:px-8 sm:py-14">
      <BrandPrivacyNotice publicSlug={publicSlug} />
    </main>
  );
}
