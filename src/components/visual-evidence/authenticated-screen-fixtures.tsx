"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";

import type { Id } from "@convex/_generated/dataModel";
import { AccountDeletionSection } from "@/components/account/account-closure";
import { AccountFreeProjectSelectionView } from "@/components/billing/account-free-project-selection";
import { AccountProfileView } from "@/components/account/account-profile";
import { BrandLogo } from "@/components/brand-logo";
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
import {
  OrganizationSettingsView,
  WorkspaceDeletionProgress,
  WorkspaceDeletionSection,
} from "@/components/organizations/organization-settings";
import { ManagedSubmissionView } from "@/components/submissions/managed-submission";
import { HostedWall } from "@/components/public-wall/hosted-wall";
import {
  InboxFeedback,
  InboxFilters,
  TestimonialDeleteDialog,
  TestimonialInboxView,
  WallCurationPanel,
} from "@/components/testimonials/testimonial-inbox";
import { PublishedCurationView } from "@/components/testimonials/published-curation";
import { Button } from "@/components/ui/button";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <AccountProfileView
      currentImage={image.imageUrl}
      email="visual-evidence@example.invalid"
      initialName="Visual Evidence User"
      onRemoveImage={image.remove}
      onSaveName={async () => undefined}
      onUploadImage={image.upload}
    />
  );
}

export function OnboardingScreenFixture() {
  return (
    <main className="bg-paper min-h-svh px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-10">
        <BrandLogo />
        <PageHeader
          description="Set the public identity and Collection Form your customers will see."
          eyebrow="First step"
          title="Create your Brand"
        />
        <OrganizationOnboardingFormView
          createOrganization={async () => ({
            id: "fixture-organization" as Id<"organizations">,
            publicSlug: "fernhill-studio",
            slug: "fernhill-studio-l5pg",
          })}
          generateUploadUrl={async () => "fixture://upload"}
          navigate={() => undefined}
          setLogo={async () => null}
          uploadImage={async () => "fixture-image" as Id<"_storage">}
        />
      </div>
    </main>
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
      <Card className="w-full max-w-xl shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-2xl">Video upload progress</CardTitle>
          <CardDescription>
            Your testimonial is being sent securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUploadProgress
            onCancel={() => undefined}
            phase="uploading"
            progress={62}
          />
        </CardContent>
      </Card>
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
  card: {
    aspectRatio: "4:3",
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

export function TestimonialInboxScreenFixture() {
  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/w/${collectionFormFixtureBrand.publicSlug}` as Route}
              target="_blank"
            >
              Open Public Wall
              <IconExternalLink aria-hidden="true" />
            </Link>
          </Button>
        }
        description="Review private Submissions and choose what becomes public."
        eyebrow="Workspace"
        title="Inbox"
      />
      <InboxFilters
        moderationStatus="all"
        onModerationStatusChange={() => undefined}
        onSortChange={() => undefined}
        onSubmissionTypeChange={() => undefined}
        sort="newest"
        submissionType="all"
      />
      <InboxFeedback error={null} message={null} />
      <TestimonialInboxView
        accentColor={collectionFormFixtureBrand.primaryColor}
        onAction={() => undefined}
        testimonials={[
          processingVideoTestimonialFixture,
          spamTestimonialFixture,
          { ...videoTestimonialFixture, moderationStatus: "published" },
          testimonialFixture,
        ]}
      />
      <WallCurationPanel>
        <PublishedCurationView
          onMove={async () => undefined}
          onSetVisibility={async () => undefined}
          testimonials={[
            {
              submissionType: "video",
              submitterName: "Remy Jupille",
              testimonialId: "fixture-published-video" as Id<"testimonials">,
            },
            {
              overrides: { company: false },
              submissionType: "text",
              submitterName: "Alice Martin",
              testimonialId: "fixture-published-text" as Id<"testimonials">,
            },
          ]}
        />
      </WallCurationPanel>
    </section>
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
      phase="providerCleanup"
      status="failed"
    />
  );
}

export function DashboardBackgroundScreenFixture({
  plan = "free",
  inactive = false,
}: {
  plan?: "free" | "premium";
  inactive?: boolean;
}) {
  const projects = [
    { id: "fixture-harbor", name: "Harbor Studio", slug: "harbor-studio" },
    {
      id: "fixture-northwind",
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
      authorization={{
        can: { manageOwnership: true, updateOrganization: true },
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
          canCreateProject={plan === "premium"}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization
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
        pendingCount={0}
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
            id: "fixture-harbor" as Id<"organizations">,
            name: "Harbor Studio",
          },
          {
            id: "fixture-northwind" as Id<"organizations">,
            name: "Northwind Coffee",
          },
        ]}
        freeProjectId={"fixture-harbor" as Id<"organizations">}
        freeProjectName="Harbor Studio"
        status="Exhausted"
        loadMore={() => undefined}
        selectProject={async () => undefined}
      />
    </section>
  );
}
