import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OnboardingStage } from "@/components/kit/onboarding-stage";
import { isOnboardingStepId } from "@/lib/onboarding-journey";

export const metadata: Metadata = {
  title: "Onboarding stage",
};

/** The frame inside the onboarding playground; also opens on its own. */
export default async function OnboardingStageRoute({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { step } = await searchParams;
  return (
    <OnboardingStage
      initialStep={isOnboardingStepId(step) ? step : "sign-up"}
    />
  );
}
