"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { IconExternalLink, IconMenu2 } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";

import type { Id } from "@convex/_generated/dataModel";
import { AccountProfileView } from "@/components/account/account-profile";
import { BrandLogo } from "@/components/brand-logo";
import { BrandMark } from "@/components/brand-mark";
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
  type InboxCategory,
  type InboxTestimonial,
  InboxFeedback,
  InboxCategoryTabs,
  TestimonialDeleteDialog,
  TestimonialInboxView,
} from "@/components/testimonials/testimonial-inbox";
import { VideoPreviewDialog } from "@/components/testimonials/video-preview-dialog";
import { WallDisplayDialog } from "@/components/testimonials/wall-display-dialog";
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
          description="This is the identity your customers see when you ask them for a Testimonial. Only the name is needed; we write the rest for you."
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
  const lists = {
    archived: [],
    pending: [
      processingVideoTestimonialFixture,
      testimonialFixture,
      videoTestimonialFixture,
    ],
    published: [
      { ...videoTestimonialFixture, moderationStatus: "published" as const },
      {
        ...testimonialFixture,
        moderationStatus: "published" as const,
        publicVisibilityOverrides: { company: false },
      },
    ],
    spam: [spamTestimonialFixture],
  };
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
      <InboxFeedback error={null} message={null} />
      <InboxCategoryTabs
        counts={{ archived: 0, pending: 3, published: 2, spam: 1 }}
        moderationStatus={category}
        onModerationStatusChange={setCategory}
      >
        <TestimonialInboxView
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
          onMove={category === "published" ? async () => undefined : undefined}
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
      phase="providerCleanup"
      status="failed"
    />
  );
}

export function DashboardBackgroundScreenFixture() {
  return (
    <div
      className="dashboard-frame flex h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "16.25rem",
        } as CSSProperties
      }
    >
      <aside className="bg-sidebar text-sidebar-foreground relative z-10 hidden w-(--sidebar-width) shrink-0 flex-col border-r md:flex">
        <div className="flex h-full w-full flex-col" data-slot="sidebar-inner">
          <div className="flex flex-1 flex-col gap-4 p-2">
            <div className="flex items-center gap-3 rounded-md p-2">
              <BrandMark />
              <span className="min-w-0">
                <span className="text-ink block truncate text-sm font-semibold tracking-[-0.008em]">
                  Fernhill Studio
                </span>
                <span className="text-ink-2 block truncate font-mono text-[11px]">
                  /c/fernhill-studio
                </span>
              </span>
            </div>
            <nav className="space-y-5 p-2">
              <div>
                <p className="mb-2 px-2" data-sidebar="group-label">
                  Workspace
                </p>
                <div className="space-y-1">
                  <button
                    className="bg-brand-soft text-ink relative flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-semibold tracking-[-0.008em]"
                    data-active="true"
                    data-sidebar="menu-button"
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-brand absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-full"
                    />
                    Overview
                  </button>
                  {["Inbox", "Public Wall", "Brand settings"].map((label) => (
                    <button
                      className="hover:bg-sidebar-accent flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium tracking-[-0.008em]"
                      data-sidebar="menu-button"
                      key={label}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </aside>
      <main className="dashboard-view relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6">
            <button
              aria-label="Open navigation"
              className="grid size-8 place-items-center rounded-md md:hidden"
              type="button"
            >
              <IconMenu2 aria-hidden="true" className="size-4" />
            </button>
            <p className="text-ink-2 text-sm font-medium tracking-[-0.008em]">
              Overview
            </p>
          </header>
          <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-5 md:p-8">
            <BrandDashboardView
              copyCollectionUrl={async () => undefined}
              name="Fernhill Studio"
              pendingCount={0}
              publicSlug="fernhill-studio"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
