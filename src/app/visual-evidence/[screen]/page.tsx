import { LoadingStatesFixture } from "@/components/visual-evidence/loading-states-fixture";
import { BlobLoaderScreen } from "@/components/brand/blob-loader";
import { RichTestimonialScreenFixture } from "@/components/visual-evidence/rich-testimonial-fixture";
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
  DashboardPendingScreenFixture,
  AccountDeletionScreenFixture,
  AccountFreeProjectScreenFixture,
  ProProjectsScreenFixture,
  InactiveProjectScreenFixture,
  EmptyPublicWallScreenFixture,
  ManagedSubmissionScreenFixture,
  ManagedVideoProcessingScreenFixture,
  OnboardingScreenFixture,
  OrganizationSettingsScreenFixture,
  ProjectSettingsShellFixture,
  ProfileScreenFixture,
  ProPublicWallScreenFixture,
  PublicWallScreenFixture,
  TestimonialDeleteScreenFixture,
  TestimonialInboxScreenFixture,
  ToastErrorScreenFixture,
  ToastSuccessScreenFixture,
  VideoRetryScreenFixture,
  VideoUploadProgressScreenFixture,
  WorkspaceDeletionScreenFixture,
  WorkspaceDeletionProgressScreenFixture,
} from "@/components/visual-evidence/authenticated-screen-fixtures";

const screens = {
  "project-settings-shell": ProjectSettingsShellFixture,
  "loading-states": LoadingStatesFixture,
  "full-page-loading": BlobLoaderScreen,
  "rich-testimonial": RichTestimonialScreenFixture,
  "collection-form": CollectionFormScreenFixture,
  "collection-form-closed": CollectionFormClosedScreenFixture,
  "collection-form-details": CollectionFormDetailsScreenFixture,
  "collection-form-success": CollectionFormSuccessScreenFixture,
  "collection-form-video": CollectionFormVideoScreenFixture,
  "collection-form-write": CollectionFormWriteScreenFixture,
  "managed-submission": ManagedSubmissionScreenFixture,
  "managed-video-processing": ManagedVideoProcessingScreenFixture,
  "privacy-notice": BrandPrivacyNoticeScreenFixture,
  "public-wall": PublicWallScreenFixture,
  "public-wall-empty": EmptyPublicWallScreenFixture,
  "public-wall-pro": ProPublicWallScreenFixture,
  "testimonial-inbox": TestimonialInboxScreenFixture,
  "toast-error": ToastErrorScreenFixture,
  "toast-success": ToastSuccessScreenFixture,
  "testimonial-delete": TestimonialDeleteScreenFixture,
  "video-retry": VideoRetryScreenFixture,
  "video-upload-progress": VideoUploadProgressScreenFixture,
  "workspace-delete": WorkspaceDeletionScreenFixture,
  "workspace-delete-progress": WorkspaceDeletionProgressScreenFixture,
  dashboard: DashboardBackgroundScreenFixture,
  "dashboard-pending": DashboardPendingScreenFixture,
  "account-deletion": AccountDeletionScreenFixture,
  "account-free-project": AccountFreeProjectScreenFixture,
  "account-pro": ProProjectsScreenFixture,
  "inactive-project": InactiveProjectScreenFixture,
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

  return screen === "project-settings-shell" ||
    screen === "full-page-loading" ||
    screen === "onboarding" ||
    screen === "dashboard" ||
    screen === "dashboard-pending" ||
    screen === "account-pro" ||
    screen === "inactive-project" ||
    screen.startsWith("collection-form") ||
    screen === "managed-submission" ||
    screen === "video-retry" ||
    screen === "video-upload-progress" ||
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
