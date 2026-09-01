import { notFound } from "next/navigation";

import { BillingVisualFixture } from "@/components/billing/billing-visual-fixture";

export default async function BillingVisualEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ availability?: string; role?: string }>;
}) {
  if (process.env.VISUAL_EVIDENCE_MODE !== "true") notFound();

  const params = await searchParams;
  const availability =
    params.availability === "unavailable" ? "unavailable" : "available";
  const role = params.role === "admin" ? "admin" : "owner";

  return <BillingVisualFixture availability={availability} role={role} />;
}
