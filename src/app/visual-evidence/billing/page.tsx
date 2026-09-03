import { notFound } from "next/navigation";

import { BillingVisualFixture } from "@/components/billing/billing-visual-fixture";

export default async function BillingVisualEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{
    availability?: string;
    checkout?: string;
    role?: string;
    state?: string;
  }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VISUAL_EVIDENCE_FIXTURES !== "true"
  ) {
    notFound();
  }

  const params = await searchParams;
  const availability =
    params.availability === "unavailable" ? "unavailable" : "available";
  const checkoutReturn = params.checkout === "success" ? "success" : null;
  const role = params.role === "admin" ? "admin" : "owner";
  const state =
    params.state === "active" ||
    params.state === "past_due" ||
    params.state === "cancellation_scheduled"
      ? params.state
      : "missing";

  return (
    <BillingVisualFixture
      availability={availability}
      checkoutReturn={checkoutReturn}
      role={role}
      state={state}
    />
  );
}
