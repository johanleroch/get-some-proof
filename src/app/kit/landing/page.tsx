import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingKit } from "@/components/kit/landing-kit";

export const metadata: Metadata = {
  title: "Landing page kit",
};

export default function LandingKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LandingKit />;
}
