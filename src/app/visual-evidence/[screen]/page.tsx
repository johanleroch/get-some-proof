import { TestimonialLinksFixture } from "@/components/visual-evidence/testimonial-links-fixture";
import {
  ImportConsentFixture,
  ImportConsentFreeFixture,
} from "@/components/visual-evidence/import-consent-fixture";
import { AssistantImportRecoveryFixture } from "@/components/visual-evidence/assistant-import-recovery-fixture";
import { AccountSecurity } from "@/components/account/account-security";
import { LoadingStatesFixture } from "@/components/visual-evidence/loading-states-fixture";
import {
  TestimonialImportFixture,
  PublicTestimonialImportFixture,
  TestimonialImportUrlFixture,
  ImportPublicationFixture,
  TestimonialImportExpiredFixture,
  TestimonialImportVideoFailedFixture,
  TestimonialImportVideoProcessingFixture,
} from "@/components/visual-evidence/testimonial-import-fixture";
import { BlobLoaderScreen } from "@/components/brand/blob-loader";
import { RichTestimonialScreenFixture } from "@/components/visual-evidence/rich-testimonial-fixture";
import { VideoThumbnailScreenFixture } from "@/components/visual-evidence/video-thumbnail-fixture";
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
  TestimonialInboxDetailsScreenFixture,
  TestimonialInboxPublishedScreenFixture,
  TestimonialInboxScreenFixture,
  ToastErrorScreenFixture,
  ToastSuccessScreenFixture,
  VideoRetryScreenFixture,
  VideoUploadProgressScreenFixture,
  WorkspaceDeletionScreenFixture,
  WorkspaceDeletionProgressScreenFixture,
} from "@/components/visual-evidence/authenticated-screen-fixtures";

const screens = {
  "testimonial-links": TestimonialLinksFixture,
  "assistant-import-recovery": AssistantImportRecoveryFixture,
  "mcp-setup": McpSetupFixture,
  "mcp-setup-free": McpFreeSetupFixture,
  "mcp-setup-connected": McpConnectedSetupFixture,
  "assistant-import-consent": ImportConsentFixture,
  "assistant-import-consent-free": ImportConsentFreeFixture,
  "testimonial-import": TestimonialImportFixture,
  "testimonial-import-public": PublicTestimonialImportFixture,
  "testimonial-import-url": TestimonialImportUrlFixture,
  "testimonial-import-publication": ImportPublicationFixture,
  "testimonial-import-expired": TestimonialImportExpiredFixture,
  "testimonial-import-video-failed": TestimonialImportVideoFailedFixture,
  "testimonial-import-video-processing":
    TestimonialImportVideoProcessingFixture,
  "account-security": AccountSecurity,
  "project-settings-shell": ProjectSettingsShellFixture,
  "loading-states": LoadingStatesFixture,
  "full-page-loading": BlobLoaderScreen,
  "rich-testimonial": RichTestimonialScreenFixture,
  "video-thumbnail": VideoThumbnailScreenFixture,
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
  "testimonial-inbox-published": TestimonialInboxPublishedScreenFixture,
  "testimonial-inbox-details": TestimonialInboxDetailsScreenFixture,
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

  return screen === "profile" ||
    screen.startsWith("testimonial-import") ||
    screen === "project-settings-shell" ||
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
import {
  McpSetupFixture,
  McpConnectedSetupFixture,
  McpFreeSetupFixture,
} from "@/components/visual-evidence/mcp-setup-fixture";
