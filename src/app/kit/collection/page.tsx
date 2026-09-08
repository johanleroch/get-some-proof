import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProofFormatVariants } from "@/components/kit/proof-format-variants";

export const metadata: Metadata = {
  title: "Collection Form kit",
};

export default function CollectionFormKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ProofFormatVariants />;
}
