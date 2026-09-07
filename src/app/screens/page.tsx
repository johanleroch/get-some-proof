import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScreensGallery } from "@/components/screens/screens-gallery";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { screenSections } from "@/lib/screens-catalog";
import { readScreenStatuses } from "@/lib/screens-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Screens",
};

export default async function ScreensPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <ScreensGallery
      fixturesEnabled={process.env.VISUAL_EVIDENCE_FIXTURES === "true"}
      initialStatuses={await readScreenStatuses()}
      liveEnabled={getPublicEnvironment().configured}
      sections={screenSections}
    />
  );
}
