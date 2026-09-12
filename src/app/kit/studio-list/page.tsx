import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudioListVariants } from "@/components/kit/studio-list-variants";

export const metadata: Metadata = {
  title: "Studio list variants",
};

export default function StudioListRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <StudioListVariants />;
}
