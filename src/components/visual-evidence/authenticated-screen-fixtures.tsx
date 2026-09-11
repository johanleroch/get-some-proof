"use client";

import { BulkTestimonialInbox } from "@/components/testimonials/bulk-testimonial-inbox";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AccountDeletionSection } from "@/components/account/account-closure";
import { AccountFreeProjectSelectionView } from "@/components/billing/account-free-project-selection";
import { AccountProfileView } from "@/components/account/account-profile";
import { AppShellView } from "@/components/app-shell";
import { NavUserView } from "@/components/account/nav-user";
import { OrganizationSwitcherView } from "@/components/organizations/organization-switcher";
import { BrandDashboardView } from "@/components/organizations/organization-dashboard";
import { PageHeader } from "@/components/page-header";
import { BrandPrivacyNoticeView } from "@/components/collection/brand-privacy-notice";
import { CollectionFormShellView } from "@/components/collection/collection-form-shell";
import { VideoRetryFormView } from "@/components/collection/video-retry-form";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";
import { OrganizationOnboardingFormView } from "@/components/organizations/organization-onboarding-form";
import { OrganizationOnboardingScreen } from "@/components/organizations/organization-onboarding-screen";
import {
  OrganizationSettingsView,
  WorkspaceDeletionProgress,
  WorkspaceDeletionSection,
} from "@/components/organizations/organization-settings";
import { ManagedSubmissionView } from "@/components/submissions/managed-submission";
import { HostedWall } from "@/components/public-wall/hosted-wall";
import {
  type InboxCategory,
  type InboxTestimonial,
  InboxFeedback,
  InboxImportActions,
  InboxCategoryTabs,
  TestimonialDeleteDialog,
} from "@/components/testimonials/testimonial-inbox";
import { VideoPreviewDialog } from "@/components/testimonials/video-preview-dialog";
import { WallDisplayDialog } from "@/components/testimonials/wall-display-dialog";
import { Button } from "@/components/ui/button";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";

function useFixtureImage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  return {
    imageUrl,
    remove: async () => setImageUrl(null),
    upload: async (blob: Blob) => setImageUrl(URL.createObjectURL(blob)),
  };
}

/**
 * The fictional project every authenticated screenshot is taken on: Bumpr's
 * own mark on its black, the only fixture asset under `public/fixtures/`.
 * Dropping a different file at that path changes every screenshot at once.
 */
const bumprLogo = "/fixtures/bumpr-logo.svg";

export function ToastErrorScreenFixture() {
  return (
    <section className="bg-card min-h-64 rounded-xl border p-6 shadow-xs">
      <h1 className="text-2xl font-semibold">Error notification</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
        Errors now appear as dismissible notifications without shifting the form
        layout.
      </p>
      <ErrorToast message="Unable to save your changes. Please try again." />
    </section>
  );
}

export function ToastSuccessScreenFixture() {
  return (
    <section className="bg-card min-h-64 rounded-xl border p-6 shadow-xs">
      <h1 className="text-2xl font-semibold">Success notification</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
        Completed actions now appear as dismissible notifications without
        shifting the page layout.
      </p>
      <SuccessToast message="Testimonial permanently deleted." />
    </section>
  );
}

export function ProfileScreenFixture() {
  const image = useFixtureImage();
  return (
    <AppShellView
      organizationId={"fixture-bumpr" as Id<"organizations">}
      organizationName="Bumpr"
      organizationPublicSlug="bumpr"
      organizationSlug="bumpr"
      pathname="/account/profile"
      account={{
        effectivePlan: "free",
        freeProjectId: "fixture-bumpr" as Id<"organizations">,
      }}
      connected
      userMenu={
        <NavUserView
          user={{ name: "Alex Morgan", email: "alex@example.test" }}
          signOut={async () => undefined}
        />
      }
      projectSwitcher={
        <OrganizationSwitcherView
          canCreateProject={false}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization
          currentLogoUrl={bumprLogo}
          currentName="Bumpr"
          currentSlug="bumpr"
          organizations={[
            {
              id: "fixture-bumpr",
              logoUrl: bumprLogo,
              name: "Bumpr",
              slug: "bumpr",
            },
          ]}
          status="Exhausted"
          loadMore={() => undefined}
          switchProject={() => undefined}
        />
      }
    >
      <AccountProfileView
        currentImage={image.imageUrl}
        email="visual-evidence@example.invalid"
        initialName="Visual Evidence User"
        onRemoveImage={image.remove}
        onSaveName={async () => undefined}
        onUploadImage={image.upload}
      />
    </AppShellView>
  );
}

export function OnboardingScreenFixture() {
  return (
    <OrganizationOnboardingScreen>
      <OrganizationOnboardingFormView
        createOrganization={async () => ({
          id: "fixture-organization" as Id<"organizations">,
          publicSlug: "fernhill-studio",
          slug: "fernhill-studio-l5pg",
        })}
        generateUploadUrl={async () => "fixture://upload"}
        navigate={() => undefined}
        setLogo={async () => null}
        uploadImage={async () => ({
          storageId: "fixture-image" as Id<"_storage">,
          verificationId:
            "fixture-image-verification" as Id<"directImageVerifications">,
          metadata: {
            contentType: "image/webp",
            height: 128,
            kind: "brandLogo",
            originalContentType: "image/png",
            originalSize: 1024,
            size: 512,
            source: "direct",
            transformVersion: "webp-v1",
            width: 128,
          },
        })}
      />
    </OrganizationOnboardingScreen>
  );
}

const collectionFormFixtureBrand = {
  collectionFormDescription:
    "Tell us how our work changed your business. A few honest sentences are perfect.",
  collectionFormTitle: "Share your Fernhill Studio story",
  logoUrl: null,
  name: "Fernhill Studio",
  primaryColor: "#0f766e",
  privacyContact: "privacy@example.invalid",
  publicSlug: "fernhill-studio",
};

const collectionFormFixtureValues = {
  ageConfirmed: true,
  company: "Bellwether Coffee",
  consentAccepted: true,
  rating: 5,
  role: "Founder",
  submitterEmail: "alice@example.com",
  submitterName: "Alice Martin",
  text: "Fernhill turned a folder of kind emails into proof we can actually show. Two new clients mentioned the wall on our first call.",
};

export function CollectionFormScreenFixture() {
  return <CollectionFormShellView brand={collectionFormFixtureBrand} />;
}

export function CollectionFormClosedScreenFixture() {
  return (
    <CollectionFormShellView
      availability={{ textAvailable: false, videoAvailable: false }}
      brand={collectionFormFixtureBrand}
    />
  );
}

export function CollectionFormWriteScreenFixture() {
  return (
    <CollectionFormShellView
      brand={collectionFormFixtureBrand}
      initialStep={2}
      initialValues={collectionFormFixtureValues}
    />
  );
}

export function CollectionFormVideoScreenFixture() {
  return (
    <CollectionFormShellView
      brand={collectionFormFixtureBrand}
      initialProofType="video"
      initialStep={2}
      recorderVisualFixture
    />
  );
}

export function VideoUploadProgressScreenFixture() {
  return (
    <main
      className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12"
      style={
        {
          "--brand-accent": collectionFormFixtureBrand.primaryColor,
        } as CSSProperties
      }
    >
      {/* The block as the form shows it: no frame of its own around it. The
          title belongs to the review page, which the capture waits for. */}
      <div className="w-full max-w-[520px] space-y-4">
        <h1 className="type-heading">Video upload progress</h1>
        <VideoUploadProgress
          onCancel={() => undefined}
          phase="uploading"
          progress={62}
        />
        <VideoUploadProgress phase="processing" progress={100} />
      </div>
    </main>
  );
}

export function VideoRetryScreenFixture() {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12">
      <VideoRetryFormView
        context={{
          brandName: collectionFormFixtureBrand.name,
          publicSlug: collectionFormFixtureBrand.publicSlug,
          spokenLanguage: "fr",
        }}
        createRetryUpload={async () => ({
          provider: "fake",
          reservationId: "visual-retry-reservation" as Id<"videoReservations">,
          uploadUrl: "https://fake-mux.invalid/replacement",
        })}
        token="visual-evidence-token"
      />
    </main>
  );
}

export function CollectionFormDetailsScreenFixture() {
  return (
    <CollectionFormShellView
      brand={collectionFormFixtureBrand}
      initialStep={3}
      initialValues={collectionFormFixtureValues}
    />
  );
}

export function CollectionFormSuccessScreenFixture() {
  return (
    <CollectionFormShellView
      brand={collectionFormFixtureBrand}
      initialStep={4}
      initialValues={collectionFormFixtureValues}
    />
  );
}

export function BrandPrivacyNoticeScreenFixture() {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12">
      <BrandPrivacyNoticeView brand={collectionFormFixtureBrand} />
    </main>
  );
}

export function ManagedSubmissionScreenFixture() {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12">
      <ManagedSubmissionView
        submission={{
          avatarUrl: null,
          brandName: collectionFormFixtureBrand.name,
          company: collectionFormFixtureValues.company,
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          currentVideo: {
            playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
            posterTimeSeconds: 30,
          },
          moderationStatus: "published",
          privacyContact: collectionFormFixtureBrand.privacyContact,
          publicSlug: collectionFormFixtureBrand.publicSlug,
          role: collectionFormFixtureValues.role,
          submissionType: "video",
          submitterEmail: collectionFormFixtureValues.submitterEmail,
          submitterName: collectionFormFixtureValues.submitterName,
          text: "",
        }}
      />
    </main>
  );
}

const testimonialFixture = {
  card: {
    avatarUrl: null,
    company: "Bellwether Coffee",
    id: "fixture-testimonial",
    name: "Alice Martin",
    publishedAt: Date.UTC(2026, 8, 3),
    rating: 5,
    role: "Founder",
    text: collectionFormFixtureValues.text,
    type: "text" as const,
  },
  consentAcceptedAt: Date.UTC(2026, 8, 3),
  createdAt: Date.UTC(2026, 8, 3),
  moderationStatus: "pending" as const,
  submissionType: "text" as const,
  submitterEmail: "alice@example.invalid",
  submitterName: "Alice Martin",
  testimonialId: "fixture-testimonial" as Id<"testimonials">,
};

const videoTestimonialFixture = {
  // Portrait, as a phone records it for the Collection Form.
  aspectRatio: "9:16",
  card: {
    aspectRatio: "9:16",
    avatarUrl: null,
    captionsAvailable: true,
    id: "fixture-video-testimonial",
    name: "Remy Jupille",
    playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
    posterTimeSeconds: 34,
    publishedAt: Date.UTC(2026, 8, 2),
    rating: 5,
    role: "Founder",
    type: "video" as const,
  },
  captionsStatus: "ready" as const,
  consentAcceptedAt: Date.UTC(2026, 8, 2),
  createdAt: Date.UTC(2026, 8, 2),
  moderationStatus: "pending" as const,
  submissionType: "video" as const,
  submitterEmail: "remy@example.invalid",
  submitterName: "Remy Jupille",
  testimonialId: "fixture-video-testimonial" as Id<"testimonials">,
  videoDurationSeconds: 42,
  videoStatus: "ready" as const,
};

const processingVideoTestimonialFixture = {
  aspectRatio: "9:16",
  card: null,
  captionsStatus: "requested" as const,
  consentAcceptedAt: Date.UTC(2026, 8, 6),
  createdAt: Date.UTC(2026, 8, 6),
  moderationStatus: "pending" as const,
  submissionType: "video" as const,
  submitterEmail: "nora@example.invalid",
  submitterName: "Nora Lewis",
  testimonialId: "fixture-processing-video" as Id<"testimonials">,
  videoStatus: "processing" as const,
};

const spamTestimonialFixture = {
  ...testimonialFixture,
  card: {
    ...testimonialFixture.card,
    id: "fixture-spam-testimonial",
    name: "Suspicious Submission",
  },
  moderationStatus: "spam" as const,
  quarantineExpiresAt: Date.UTC(2026, 8, 10),
  spamCreditRestored: true,
  submitterEmail: "spam@example.invalid",
  submitterName: "Suspicious Submission",
  testimonialId: "fixture-spam-testimonial" as Id<"testimonials">,
};

/**
 * The Inbox with one Testimonial in every state the list draws: a video
 * still processing, a text Testimonial, a Ready video, then the Published
 * category in its Wall order and one Spam row. The tabs switch between local
 * lists so the gallery can be walked like the real page.
 */
export function TestimonialInboxScreenFixture({
  initialCategory = "pending",
}: {
  initialCategory?: InboxCategory;
}) {
  const [category, setCategory] = useState<InboxCategory>(initialCategory);
  // The still opens the real card, here as on the live page.
  const [preview, setPreview] = useState<InboxTestimonial | null>(null);
  // The Wall order moves for real, so the arrows and the drag can be tried.
  const [published, setPublished] = useState<InboxTestimonial[]>([
    { ...videoTestimonialFixture, moderationStatus: "published" as const },
    {
      ...testimonialFixture,
      moderationStatus: "published" as const,
      publicVisibilityOverrides: { company: false },
    },
  ]);
  const lists: Record<InboxCategory, InboxTestimonial[]> = {
    archived: [],
    pending: [
      processingVideoTestimonialFixture,
      testimonialFixture,
      videoTestimonialFixture,
    ],
    published,
    spam: [spamTestimonialFixture],
  };
  const move = async (
    testimonialId: Id<"testimonials">,
    beforeTestimonialId: Id<"testimonials"> | undefined,
    afterTestimonialId: Id<"testimonials"> | undefined,
  ) => {
    setPublished((current) => {
      const moved = current.find(
        (item) => item.testimonialId === testimonialId,
      );
      if (!moved) return current;
      const rest = current.filter((item) => item !== moved);
      const beforeIndex = rest.findIndex(
        (item) => item.testimonialId === beforeTestimonialId,
      );
      const afterIndex = rest.findIndex(
        (item) => item.testimonialId === afterTestimonialId,
      );
      const at =
        beforeIndex >= 0 ? beforeIndex + 1 : afterIndex >= 0 ? afterIndex : 0;
      return [...rest.slice(0, at), moved, ...rest.slice(at)];
    });
  };
  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          <InboxImportActions
            slug="fernhill-studio-l5pg"
            publicSlug={collectionFormFixtureBrand.publicSlug}
          />
        }
        description="Review private Submissions and choose what becomes public."
        eyebrow="Workspace"
        title="Inbox"
      />
      <InboxFeedback error={null} message={null} />
      <InboxCategoryTabs
        counts={{ archived: 0, pending: 3, published: 2, spam: 1 }}
        moderationStatus={category}
        onModerationStatusChange={setCategory}
      >
        <BulkTestimonialInbox
          key={category}
          totalCount={lists[category].length}
          hasMore={false}
          loadPage={async () => ({
            page: lists[category],
            isDone: true,
            continueCursor: "",
          })}
          perform={async () => {}}
          accentColor={collectionFormFixtureBrand.primaryColor}
          category={category}
          emptyAction={
            category === "pending" ? null : (
              <Button onClick={() => setCategory("pending")} variant="outline">
                Go to Pending
              </Button>
            )
          }
          onAction={(testimonial, action) => {
            if (action === "preview") setPreview(testimonial);
          }}
          onMove={category === "published" ? move : undefined}
          pendingId={null}
          testimonials={lists[category]}
        />
      </InboxCategoryTabs>
      {preview?.card?.type === "video" ? (
        <VideoPreviewDialog
          accentColor={collectionFormFixtureBrand.primaryColor}
          onClose={() => setPreview(null)}
          submitterName={preview.submitterName}
          testimonial={preview.card}
        />
      ) : null}
    </section>
  );
}

export function TestimonialInboxPublishedScreenFixture() {
  return <TestimonialInboxScreenFixture initialCategory="published" />;
}

/** The details dialog open on a Published text card, one detail overridden. */
export function TestimonialInboxDetailsScreenFixture() {
  return (
    <>
      <TestimonialInboxScreenFixture initialCategory="published" />
      <WallDisplayDialog
        accentColor={collectionFormFixtureBrand.primaryColor}
        onClose={() => undefined}
        onSave={async () => undefined}
        overrides={{ company: false }}
        submitterName={testimonialFixture.submitterName}
        testimonial={testimonialFixture.card}
      />
    </>
  );
}

export function TestimonialDeleteScreenFixture() {
  return (
    <>
      <TestimonialInboxScreenFixture />
      <TestimonialDeleteDialog
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        pending={false}
        target={videoTestimonialFixture}
      />
    </>
  );
}

const wallFixture = {
  accentColor: collectionFormFixtureBrand.primaryColor,
  attributionRequired: true,
  brandName: collectionFormFixtureBrand.name,
  publicSlug: collectionFormFixtureBrand.publicSlug,
  theme: "dark" as const,
  testimonials: [
    {
      aspectRatio: "9:16",
      avatarUrl: null,
      captionsAvailable: true,
      id: "fixture-public-video-1",
      name: "Remy Jupille",
      playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
      posterTimeSeconds: 40,
      publishedAt: Date.UTC(2026, 8, 4),
      rating: 5,
      role: "Founder",
      type: "video" as const,
    },
    {
      aspectRatio: "3:4",
      avatarUrl: null,
      captionsAvailable: true,
      company: "Tidewater Apps",
      id: "fixture-public-video-2",
      name: "Maya Chen",
      playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
      posterTimeSeconds: 48,
      publishedAt: Date.UTC(2026, 8, 3, 12),
      rating: 5,
      role: "Product lead",
      type: "video" as const,
    },
    {
      avatarUrl: null,
      company: collectionFormFixtureValues.company,
      id: "fixture-public-testimonial-1",
      name: collectionFormFixtureValues.submitterName,
      publishedAt: Date.UTC(2026, 8, 3),
      rating: collectionFormFixtureValues.rating,
      role: collectionFormFixtureValues.role,
      text: collectionFormFixtureValues.text,
      type: "text" as const,
    },
    {
      avatarUrl: null,
      id: "fixture-public-testimonial-2",
      name: "Jordan Lee",
      publishedAt: Date.UTC(2026, 8, 2),
      text: "Our customers finished the form in two minutes. Nobody asked us what they were supposed to write.",
      type: "text" as const,
    },
    {
      avatarUrl: null,
      company: "Signal Works",
      id: "fixture-public-testimonial-3",
      name: "Morgan Reed",
      publishedAt: Date.UTC(2026, 8, 1),
      rating: 4,
      text: "We went from screenshots in a shared doc to a public wall in one afternoon.",
      type: "text" as const,
    },
  ],
  transparentEmbed: false,
};

export function PublicWallScreenFixture() {
  return <HostedWall wall={wallFixture} />;
}

export function ProPublicWallScreenFixture() {
  return (
    <HostedWall
      wall={{ ...wallFixture, attributionRequired: false, theme: "light" }}
    />
  );
}

export function EmptyPublicWallScreenFixture() {
  return <HostedWall wall={{ ...wallFixture, testimonials: [] }} />;
}

export function OrganizationSettingsScreenFixture() {
  const image = useFixtureImage();
  return (
    <OrganizationSettingsView
      canChangePublicSlug
      canManageWall
      canUpdate
      embedOrigin="https://proof.example"
      logoUrl={image.imageUrl}
      name="Fernhill Studio"
      onChangePublicSlug={async () => undefined}
      onRemoveLogo={image.remove}
      onRename={async () => undefined}
      onUploadLogo={image.upload}
      onUpdateWallSettings={async () => undefined}
      publicSlug="fernhill-studio"
      publicSlugCanChange
      wallSettings={{
        accentColor: "#0f766e",
        canHideAttribution: true,
        hideAttribution: false,
        theme: "system",
        transparentEmbed: true,
        visibility: {
          avatar: true,
          company: true,
          rating: true,
          role: true,
        },
      }}
    />
  );
}

export function WorkspaceDeletionScreenFixture() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="dashboard-page-title">Brand settings</h1>
        <p className="dashboard-page-description mt-1">
          Update the identity shared across your public proof surfaces.
        </p>
      </div>
      <WorkspaceDeletionSection
        brandName="Fernhill Studio"
        initialConfirmation="Fernhill Studio"
        initialDialogOpen
        onDelete={async () => undefined}
        onExport={async () => undefined}
      />
    </section>
  );
}

export function WorkspaceDeletionProgressScreenFixture() {
  return (
    <WorkspaceDeletionProgress
      brandName="Fernhill Studio"
      lastError="Mux asset deletion failed (503)"
      onRetry={async () => undefined}
      phase="deleteMedia"
      mediaProgress={{
        imagesTotal: 12,
        imagesDeleted: 12,
        videosTotal: 4,
        videosDeleted: 2,
        uploadsTotal: 0,
        uploadsDeleted: 0,
        inventoryComplete: true,
      }}
      status="failed"
    />
  );
}

export function DashboardBackgroundScreenFixture({
  pendingCount = 0,
  plan = "free",
  inactive = false,
}: {
  pendingCount?: number;
  plan?: "free" | "premium";
  inactive?: boolean;
}) {
  // Bumpr carries a logo and Northwind does not, so every screenshot of the
  // sidebar and the project menu shows both states of the title.
  const projects = [
    { id: "fixture-bumpr", logoUrl: bumprLogo, name: "Bumpr", slug: "bumpr" },
    {
      id: "fixture-northwind",
      logoUrl: null,
      name: "Northwind Coffee",
      slug: "northwind-coffee",
    },
  ];
  const [selectedSlug, setSelectedSlug] = useState(projects[0].slug);
  const project = projects.find(({ slug }) => slug === selectedSlug)!;
  const account = {
    effectivePlan: plan,
    freeProjectId: (inactive
      ? projects[1].id
      : projects[0].id) as Id<"organizations">,
    usage: {
      freeTextUsed: 4,
      freeVideoUsed: 1,
      readyVideos: 8,
      reservedVideos: 1,
    },
  };
  return (
    <AppShellView
      organizationId={project.id as Id<"organizations">}
      organizationName={project.name}
      organizationPublicSlug={project.slug}
      organizationSlug={project.slug}
      pathname={`/org/${project.slug}/dashboard`}
      account={account}
      inboxCount={pendingCount}
      connected
      userMenu={
        <NavUserView
          user={{ name: "Alex Morgan", email: "alex@example.test" }}
          signOut={async () => undefined}
        />
      }
      projectSwitcher={
        <OrganizationSwitcherView
          canCreateProject={plan === "premium"}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization
          currentLogoUrl={project.logoUrl}
          currentName={project.name}
          currentSlug={project.slug}
          organizations={
            plan === "premium" || inactive ? projects : [projects[0]]
          }
          status="Exhausted"
          loadMore={() => undefined}
          switchProject={setSelectedSlug}
        />
      }
    >
      <BrandDashboardView
        account={account}
        billingHref={`/org/${project.slug}/billing`}
        copyCollectionUrl={async () => undefined}
        name={project.name}
        pendingCount={pendingCount}
        collectionUrl={`https://getsomeproof.com/c/${project.slug}`}
        slug={project.slug}
        publicSlug={project.slug}
      />
    </AppShellView>
  );
}

export function ProProjectsScreenFixture() {
  return <DashboardBackgroundScreenFixture plan="premium" />;
}

export function InactiveProjectScreenFixture() {
  return <DashboardBackgroundScreenFixture inactive />;
}

export function ManagedVideoProcessingScreenFixture() {
  return (
    <ManagedSubmissionView
      submission={{
        avatarUrl: null,
        brandName: "Visual Studio",
        consentAcceptedAt: Date.UTC(2026, 8, 3),
        contentVersion: 1,
        currentVideo: {
          playbackId: videoTestimonialFixture.card.playbackId,
          posterTimeSeconds: 34,
        },
        moderationStatus: "published",
        privacyContact: "privacy@example.invalid",
        publicSlug: "visual-studio",
        replacement: {
          revisionId: "fixture-revision" as Id<"submissionVideoRevisions">,
          status: "processing",
        },
        submissionType: "video",
        submitterEmail: "remy@example.invalid",
        submitterName: "Remy Jupille",
        text: "",
      }}
    />
  );
}

/** The same Overview once Submissions are waiting: the queue leads. */
export function DashboardPendingScreenFixture() {
  return <DashboardBackgroundScreenFixture pendingCount={3} />;
}

export function AccountDeletionScreenFixture() {
  const fixtureRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fixtureRef.current) fixtureRef.current.dataset.fixtureReady = "true";
  }, []);
  return (
    <div ref={fixtureRef} data-fixture-ready="false">
      <AccountDeletionSection status={null} onDelete={async () => undefined} />
    </div>
  );
}

export function AccountFreeProjectScreenFixture() {
  return (
    <section className="space-y-6">
      <h1 className="type-heading">Choose your Free project</h1>
      <AccountFreeProjectSelectionView
        projects={[
          {
            id: "fixture-bumpr" as Id<"organizations">,
            name: "Bumpr",
          },
          {
            id: "fixture-northwind" as Id<"organizations">,
            name: "Northwind Coffee",
          },
        ]}
        freeProjectId={"fixture-bumpr" as Id<"organizations">}
        freeProjectName="Bumpr"
        status="Exhausted"
        loadMore={() => undefined}
        selectProject={async () => undefined}
      />
    </section>
  );
}

export function ProjectSettingsShellFixture() {
  return (
    <AppShellView
      organizationId={"fixture-project" as Id<"organizations">}
      organizationName="Fernhill Studio"
      organizationPublicSlug="fernhill-studio"
      organizationSlug="fernhill-studio"
      pathname="/org/fernhill-studio/settings"
      connected
      userMenu={null}
      projectSwitcher={null}
    >
      <OrganizationSettingsScreenFixture />
    </AppShellView>
  );
}

export function TestimonialDeletionProgressScreenFixture() {
  return (
    <>
      <TestimonialInboxScreenFixture />
      <TestimonialDeleteDialog
        onDelete={() => undefined}
        onOpenChange={() => undefined}
        pending
        target={videoTestimonialFixture}
        deletionStatus="requested"
        progress={{
          imagesTotal: 2,
          imagesDeleted: 2,
          videosTotal: 3,
          videosDeleted: 1,
          uploadsTotal: 1,
          uploadsDeleted: 0,
          inventoryComplete: true,
        }}
      />
    </>
  );
}
export function AccountDeletionProgressScreenFixture() {
  return (
    <AccountDeletionSection
      onDelete={async () => undefined}
      status={{
        status: "requested",
        mediaProgress: {
          imagesTotal: 32,
          imagesDeleted: 24,
          videosTotal: 8,
          videosDeleted: 3,
          uploadsTotal: 2,
          uploadsDeleted: 1,
          inventoryComplete: true,
        },
      }}
    />
  );
}
