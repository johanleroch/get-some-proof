"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { IconMenu2 } from "@tabler/icons-react";

import type { Id } from "@convex/_generated/dataModel";
import { AccountProfileView } from "@/components/account/account-profile";
import { BrandMark } from "@/components/brand-mark";
import { BrandPrivacyNoticeView } from "@/components/collection/brand-privacy-notice";
import { CollectionFormShellView } from "@/components/collection/collection-form-shell";
import { VideoRetryFormView } from "@/components/collection/video-retry-form";
import { OrganizationOnboardingFormView } from "@/components/organizations/organization-onboarding-form";
import { OrganizationSettingsView } from "@/components/organizations/organization-settings";
import { ManagedSubmissionView } from "@/components/submissions/managed-submission";
import { HostedWall } from "@/components/public-wall/hosted-wall";
import { TestimonialInboxView } from "@/components/testimonials/testimonial-inbox";
import { Button } from "@/components/ui/button";
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
    <main className="bg-muted/30 grid min-h-svh place-items-center px-5 py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <Card className="shadow-xs">
          <CardHeader>
            <p className="text-muted-foreground text-sm font-medium">
              First step
            </p>
            <CardTitle className="text-2xl">Create your Brand</CardTitle>
            <CardDescription>
              Set the public identity and Collection Form your customers will
              see.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationOnboardingFormView
              createOrganization={async () => ({
                id: "fixture-organization" as Id<"organizations">,
                publicSlug: "visual-studio",
                slug: "visual-studio-l5pg",
              })}
              generateUploadUrl={async () => "fixture://upload"}
              navigate={() => undefined}
              setLogo={async () => null}
              uploadImage={async () => "fixture-image" as Id<"_storage">}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

const collectionFormFixtureBrand = {
  collectionFormDescription:
    "Tell us how our work changed your business. A few honest sentences are perfect.",
  collectionFormTitle: "Share your Visual Studio story",
  logoUrl: null,
  name: "Visual Studio",
  primaryColor: "#6d5dfc",
  privacyContact: "privacy@example.invalid",
  publicSlug: "visual-studio",
};

const collectionFormFixtureValues = {
  ageConfirmed: true,
  company: "North Star Co",
  consentAccepted: true,
  rating: 5,
  role: "Founder",
  submitterEmail: "alice@example.com",
  submitterName: "Alice Martin",
  text: "Visual Studio helped us turn scattered customer stories into clear proof that wins trust.",
};

export function CollectionFormScreenFixture() {
  return <CollectionFormShellView brand={collectionFormFixtureBrand} />;
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
    />
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
          brandName: collectionFormFixtureBrand.name,
          company: collectionFormFixtureValues.company,
          moderationStatus: "pending",
          role: collectionFormFixtureValues.role,
          submitterEmail: collectionFormFixtureValues.submitterEmail,
          submitterName: collectionFormFixtureValues.submitterName,
          text: collectionFormFixtureValues.text,
        }}
      />
    </main>
  );
}

const testimonialFixture = {
  avatarUrl: null,
  company: "North Star Co",
  consentAcceptedAt: Date.UTC(2026, 8, 3),
  createdAt: Date.UTC(2026, 8, 3),
  moderationStatus: "pending" as const,
  rating: 5,
  role: "Founder",
  submissionType: "text" as const,
  submitterEmail: "alice@example.invalid",
  submitterName: "Alice Martin",
  testimonialId: "fixture-testimonial",
  text: collectionFormFixtureValues.text,
};

const videoTestimonialFixture = {
  avatarUrl: null,
  captionsStatus: "ready" as const,
  consentAcceptedAt: Date.UTC(2026, 8, 2),
  createdAt: Date.UTC(2026, 8, 2),
  durationSeconds: 68,
  moderationStatus: "pending" as const,
  playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
  rating: 5,
  role: "Founder",
  submissionType: "video" as const,
  submitterEmail: "remy@example.invalid",
  submitterName: "Remy Jupille",
  testimonialId: "fixture-video-testimonial",
  videoStatus: "ready" as const,
};

export function TestimonialInboxScreenFixture() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="dashboard-page-title">Inbox</h1>
        <p className="dashboard-page-description mt-1">
          Review private Submissions and choose what becomes public.
        </p>
      </div>
      <div className="flex gap-3">
        <select
          aria-label="Status"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option>All statuses</option>
        </select>
        <select
          aria-label="Type"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option>Text</option>
        </select>
        <select
          aria-label="Sort"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option>Newest first</option>
        </select>
      </div>
      <TestimonialInboxView
        onArchive={() => undefined}
        onDeleteRequest={() => undefined}
        onDownload={() => undefined}
        onPublish={() => undefined}
        testimonials={[videoTestimonialFixture, testimonialFixture]}
      />
    </section>
  );
}

const wallFixture = {
  accentColor: collectionFormFixtureBrand.primaryColor,
  attributionRequired: true,
  brandName: collectionFormFixtureBrand.name,
  publicSlug: collectionFormFixtureBrand.publicSlug,
  testimonials: [
    {
      avatarUrl: null,
      captionsAvailable: true,
      id: "fixture-public-video-1",
      name: "Remy Jupille",
      playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
      posterTimeSeconds: 30,
      publishedAt: Date.UTC(2026, 8, 4),
      rating: 5,
      role: "Founder",
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
      text: "The collection flow felt calm, trustworthy, and refreshingly simple for our customers.",
      type: "text" as const,
    },
    {
      avatarUrl: null,
      company: "Signal Works",
      id: "fixture-public-testimonial-3",
      name: "Morgan Reed",
      publishedAt: Date.UTC(2026, 8, 1),
      rating: 4,
      text: "We went from scattered quotes to a clean public wall in one afternoon.",
      type: "text" as const,
    },
  ],
};

export function PublicWallScreenFixture() {
  return <HostedWall wall={wallFixture} />;
}

export function EmptyPublicWallScreenFixture() {
  return <HostedWall wall={{ ...wallFixture, testimonials: [] }} />;
}

export function OrganizationSettingsScreenFixture() {
  const image = useFixtureImage();
  return (
    <OrganizationSettingsView
      canChangePublicSlug
      canUpdate
      embedOrigin="https://proof.example"
      logoUrl={image.imageUrl}
      name="Visual Studio"
      onChangePublicSlug={async () => undefined}
      onRemoveLogo={image.remove}
      onRename={async () => undefined}
      onUploadLogo={image.upload}
      publicSlug="visual-studio"
      publicSlugCanChange
    />
  );
}

export function DashboardBackgroundScreenFixture() {
  return (
    <div
      className="dashboard-frame flex h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "18rem",
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="dashboard-frame-background" />
      <aside className="relative z-10 hidden w-72 shrink-0 p-2 md:flex">
        <div
          className="bg-sidebar text-sidebar-foreground relative flex h-full w-full flex-col overflow-hidden"
          data-slot="sidebar-inner"
        >
          <div aria-hidden="true" className="dashboard-sidebar-effects" />
          <div className="flex flex-1 flex-col gap-6 p-3">
            <div>
              <p className="text-[13px] font-[510]">Visual Studio</p>
              <p className="text-muted-foreground text-xs">/c/visual-studio</p>
            </div>
            <nav className="space-y-5">
              <div>
                <p className="mb-2 px-2" data-sidebar="group-label">
                  Workspace
                </p>
                <div className="space-y-1">
                  <button
                    className="bg-sidebar-accent block rounded-lg p-2"
                    data-active="true"
                    data-sidebar="menu-button"
                    type="button"
                  >
                    Overview
                  </button>
                  <button
                    className="block rounded-lg p-2"
                    data-sidebar="menu-button"
                    type="button"
                  >
                    Inbox
                  </button>
                  <button
                    className="block rounded-lg p-2"
                    data-sidebar="menu-button"
                    type="button"
                  >
                    Public Wall
                  </button>
                  <button
                    className="block rounded-lg p-2"
                    data-sidebar="menu-button"
                    type="button"
                  >
                    Brand settings
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </aside>
      <main className="dashboard-view relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border shadow-2xl shadow-black/30 md:m-2 md:ml-0 md:rounded-xl">
        <div aria-hidden="true" className="dashboard-view-effects" />
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6">
            <button
              aria-label="Open navigation"
              className="grid size-8 place-items-center rounded-md md:hidden"
              type="button"
            >
              <IconMenu2 aria-hidden="true" className="size-4" />
            </button>
            <p className="text-[13px] font-[510]">Overview</p>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="dashboard-page-title">Visual Studio</h1>
                <p className="dashboard-page-description mt-1">
                  Collect customer proof, review it privately, and publish only
                  what you choose.
                </p>
              </div>
              <Button>Copy collection link</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="dashboard-panel p-5">
                <p className="text-muted-foreground text-[13px] font-[510]">
                  Pending Testimonials
                </p>
                <p className="mt-6 text-[30px] font-[590]">0</p>
                <p className="text-muted-foreground text-xs">
                  Ready for your first Submission
                </p>
              </section>
              <section className="dashboard-panel p-5">
                <p className="text-muted-foreground text-[13px] font-[510]">
                  Your Collection Form
                </p>
                <p className="mt-6 text-lg font-[590]">/c/visual-studio</p>
                <p className="text-muted-foreground text-xs">
                  Share this address to start collecting proof
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-frame dashboard-shine-sidebar"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-view dashboard-shine-sidebar"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-frame dashboard-shine-body"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-view dashboard-shine-body"
      />
    </div>
  );
}
