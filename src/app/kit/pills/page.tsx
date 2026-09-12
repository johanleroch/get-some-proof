import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PillVariants } from "@/components/kit/pill-variants";

export const metadata: Metadata = {
  title: "Pill variants",
};

export default function PillsRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <PillVariants />;
}
