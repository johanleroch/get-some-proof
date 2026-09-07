import type { Metadata } from "next";

import { SetupRequired } from "@/components/setup-required";
import { ManagedSubmission } from "@/components/submissions/managed-submission";
import { getPublicEnvironment } from "@/lib/env/public-env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Manage your testimonial",
};

export default async function ManagedSubmissionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const environment = getPublicEnvironment();
  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }
  const { token } = await params;
  return (
    <main className="bg-paper grid min-h-svh place-items-center px-5 py-10 sm:px-8 sm:py-14">
      <ManagedSubmission token={token} />
    </main>
  );
}
