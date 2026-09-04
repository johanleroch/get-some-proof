import { notFound } from "next/navigation";

import {
  BrandPrivacyNoticeScreenFixture,
  CollectionFormDetailsScreenFixture,
  CollectionFormClosedScreenFixture,
  CollectionFormScreenFixture,
  CollectionFormSuccessScreenFixture,
  CollectionFormVideoScreenFixture,
  CollectionFormWriteScreenFixture,
  DashboardBackgroundScreenFixture,
  EmptyPublicWallScreenFixture,
  ManagedSubmissionScreenFixture,
  OnboardingScreenFixture,
  OrganizationSettingsScreenFixture,
  ProfileScreenFixture,
  PublicWallScreenFixture,
  TestimonialDeleteScreenFixture,
  TestimonialInboxScreenFixture,
  VideoRetryScreenFixture,
  WorkspaceDeletionScreenFixture,
  WorkspaceDeletionProgressScreenFixture,
} from "@/components/visual-evidence/authenticated-screen-fixtures";

const screens = {
  "collection-form": CollectionFormScreenFixture,
  "collection-form-closed": CollectionFormClosedScreenFixture,
  "collection-form-details": CollectionFormDetailsScreenFixture,
  "collection-form-success": CollectionFormSuccessScreenFixture,
  "collection-form-video": CollectionFormVideoScreenFixture,
  "collection-form-write": CollectionFormWriteScreenFixture,
  "managed-submission": ManagedSubmissionScreenFixture,
  "privacy-notice": BrandPrivacyNoticeScreenFixture,
  "public-wall": PublicWallScreenFixture,
  "public-wall-empty": EmptyPublicWallScreenFixture,
  "testimonial-inbox": TestimonialInboxScreenFixture,
  "testimonial-delete": TestimonialDeleteScreenFixture,
  "video-retry": VideoRetryScreenFixture,
  "workspace-delete": WorkspaceDeletionScreenFixture,
  "workspace-delete-progress": WorkspaceDeletionProgressScreenFixture,
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

  return screen === "onboarding" ||
    screen === "dashboard" ||
    screen.startsWith("collection-form") ||
    screen === "managed-submission" ||
    screen === "video-retry" ||
    screen === "privacy-notice" ||
    screen.startsWith("public-wall") ? (
    <Screen />
  ) : (
    <main className="bg-muted/30 min-h-svh px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Screen />
      </div>
    </main>
  );
}
