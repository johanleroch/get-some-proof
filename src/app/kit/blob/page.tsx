import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlobSet } from "@/components/kit/blob-set";

export const metadata: Metadata = {
  title: "Blob expressions",
};

export default function BlobSetRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <BlobSet />;
}
