import { notFound } from "next/navigation";

import {
  DashboardBackgroundScreenFixture,
  OnboardingScreenFixture,
  OrganizationSettingsScreenFixture,
  ProfileScreenFixture,
} from "@/components/visual-evidence/authenticated-screen-fixtures";

const screens = {
  dashboard: DashboardBackgroundScreenFixture,
  onboarding: OnboardingScreenFixture,
  "organization-settings": OrganizationSettingsScreenFixture,
  profile: ProfileScreenFixture,
};

export default async function VisualEvidenceFixturePage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VISUAL_EVIDENCE_FIXTURES !== "true"
  ) {
    notFound();
  }

  const { screen } = await params;
  const Screen = screens[screen as keyof typeof screens];
  if (!Screen) notFound();

  return screen === "onboarding" || screen === "dashboard" ? (
    <Screen />
  ) : (
    <main className="bg-muted/30 min-h-svh px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Screen />
      </div>
    </main>
  );
}
