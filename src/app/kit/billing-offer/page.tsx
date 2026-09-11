import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BillingOfferVariants } from "@/components/kit/billing-offer-variants";

export const metadata: Metadata = {
  title: "Pro offer variants",
};

export default function BillingOfferRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <BillingOfferVariants />;
}
