import type { Metadata } from "next";

import { VideoRetryForm } from "@/components/collection/video-retry-form";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Replace your video",
};

export default async function VideoRetryPage({
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
      <VideoRetryForm token={token} />
    </main>
  );
}
