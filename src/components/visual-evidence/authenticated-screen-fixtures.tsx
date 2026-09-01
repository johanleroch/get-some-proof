"use client";

import { useState } from "react";

import type { Id } from "@convex/_generated/dataModel";
import { AccountProfileView } from "@/components/account/account-profile";
import { BrandMark } from "@/components/brand-mark";
import { OrganizationOnboardingFormView } from "@/components/organizations/organization-onboarding-form";
import { OrganizationSettingsView } from "@/components/organizations/organization-settings";
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
