import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { SetupRequired } from "@/components/setup-required";
import { isAuthenticated } from "@/lib/auth-server";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Collect and publish customer testimonials",
    description:
      "Collect text and video testimonials with one link, choose which ones go public, and add them to your website.",
    path: "/",
  }),
  robots: { index: true, follow: true },
};

/**
 * The root: a signed-out visitor reads the offer, a signed-in Owner goes
 * straight back to work, and an unconfigured deployment still shows what it
 * is missing.
 */
export default async function HomePage() {
  const environment = getPublicEnvironment();

  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }

  if (await isAuthenticated()) redirect("/dashboard");

  return <LandingPage />;
}
