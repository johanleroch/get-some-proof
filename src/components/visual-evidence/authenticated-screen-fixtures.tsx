"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AccountProfileView } from "@/components/account/account-profile";
import { BrandMark } from "@/components/brand-mark";
import { OrganizationOnboardingFormView } from "@/components/organizations/organization-onboarding-form";
import { OrganizationSettingsView } from "@/components/organizations/organization-settings";
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
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <Card className="shadow-xs">
          <CardHeader>
            <p className="text-muted-foreground text-sm font-medium">
              First step
            </p>
            <CardTitle className="text-2xl">Create your Organization</CardTitle>
            <CardDescription>
              This becomes the secure boundary for your Members, Projects, and
              administration data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationOnboardingFormView
              createOrganization={async () => ({
                id: "fixture-organization" as Id<"organizations">,
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

export function OrganizationSettingsScreenFixture() {
  const image = useFixtureImage();
  return (
    <OrganizationSettingsView
      canUpdate
      logoUrl={image.imageUrl}
      name="Visual Studio"
      onRemoveLogo={image.remove}
      onRename={async () => undefined}
      onUploadLogo={image.upload}
      slug="visual-studio-l5pg"
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
              <p className="text-muted-foreground text-xs">Convex Admin</p>
            </div>
            <button
              className="dashboard-primary-sidebar-action bg-primary text-primary-foreground h-8 rounded-lg px-3 text-left text-[13px] font-[510]"
              data-sidebar="menu-button"
              type="button"
            >
              New project
            </button>
            <nav className="space-y-5">
              <div>
                <p className="mb-2 px-2" data-sidebar="group-label">
                  Workspace
                </p>
                <div className="space-y-1">
                  <a
                    className="bg-sidebar-accent block rounded-lg p-2"
                    data-active="true"
                    data-sidebar="menu-button"
                    href="#overview"
                  >
                    Overview
                  </a>
                  <a
                    className="block rounded-lg p-2"
                    data-sidebar="menu-button"
                    href="#projects"
                  >
                    Projects
                  </a>
                </div>
              </div>
              <div>
                <p className="mb-2 px-2" data-sidebar="group-label">
                  Collaboration
                </p>
                <a
                  className="block rounded-lg p-2"
                  data-sidebar="menu-button"
                  href="#members"
                >
                  Members
                </a>
              </div>
            </nav>
          </div>
        </div>
      </aside>
      <main className="dashboard-view m-2 ml-0 min-h-0 overflow-hidden border shadow-2xl shadow-black/30">
        <div aria-hidden="true" className="dashboard-view-effects" />
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center border-b px-6">
            <p className="text-[13px] font-[510]">Overview</p>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="dashboard-page-title">Overview</h1>
                <p className="dashboard-page-description mt-1">
                  Live Organization activity and project health.
                </p>
              </div>
              <Button>View Projects</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                "Total Projects",
                "Archived Projects",
                "Active Members",
                "Pending Invitations",
              ].map((label, index) => (
                <section className="dashboard-panel p-5" key={label}>
                  <p className="text-muted-foreground text-[13px] font-[510]">
                    {label}
                  </p>
                  <p className="mt-6 text-[30px] font-[590]">
                    {[3, 1, 4, 0][index]}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Current Organization
                  </p>
                </section>
              ))}
            </div>
            <section className="dashboard-panel min-h-72 p-6">
              <h2 className="text-base font-[590]">Projects by status</h2>
              <p className="dashboard-page-description mt-1">
                Background effects remain behind this content.
              </p>
            </section>
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
