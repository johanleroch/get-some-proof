import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplatesKit } from "@/components/kit/templates-kit";

export const metadata: Metadata = {
  title: "Templates kit",
};

export default function TemplatesKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TemplatesKit />;
}
