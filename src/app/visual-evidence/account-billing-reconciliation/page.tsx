import { notFound } from "next/navigation";

import { AccountBillingReconciliationView } from "@/components/account/account-billing";

export default function AccountBillingReconciliationVisualEvidencePage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VISUAL_EVIDENCE_FIXTURES !== "true"
  ) {
    notFound();
  }

  return <AccountBillingReconciliationView />;
}
