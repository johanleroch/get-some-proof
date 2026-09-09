import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OnboardingPlayground } from "@/components/kit/onboarding-playground";
import { isOnboardingStepId } from "@/lib/onboarding-journey";

export const metadata: Metadata = {
  title: "Onboarding playground",
};

export default async function OnboardingPlaygroundRoute({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { step } = await searchParams;
  return (
    <OnboardingPlayground
      initialStep={isOnboardingStepId(step) ? step : "sign-up"}
    />
  );
}
