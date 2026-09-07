import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KitPage } from "@/components/kit/kit-page";

export const metadata: Metadata = {
  title: "Kit",
};

export default function KitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <KitPage />;
}
