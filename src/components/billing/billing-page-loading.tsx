import { BlobLoader } from "@/components/brand/blob-loader";

export function BillingPageLoading() {
  return (
    <BlobLoader className="min-h-[50vh]" label="Loading Billing…" showLabel />
  );
}
