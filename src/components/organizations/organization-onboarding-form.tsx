"use client";

import { type FormEvent, useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProfileImage } from "@/lib/upload-profile-image";

export function OrganizationOnboardingForm() {
  const router = useRouter();
  const createOrganization = useMutation(api.organizations.create);
  const generateUploadUrl = useMutation(
    api.organizations.generateLogoUploadUrl,
  );
  const setLogo = useMutation(api.organizations.setLogo);
  return (
    <OrganizationOnboardingFormView
      createOrganization={createOrganization}
      generateUploadUrl={generateUploadUrl}
      navigate={(path) => router.push(path as Route)}
      setLogo={setLogo}
      uploadImage={uploadProfileImage}
    />
  );
}

export function OrganizationOnboardingFormView({
  createOrganization,
  generateUploadUrl,
  navigate,
  setLogo,
  uploadImage,
}: {
  createOrganization: (args: { name: string }) => Promise<{
    id: Id<"organizations">;
    slug: string;
  }>;
  generateUploadUrl: (args: {
    organizationId: Id<"organizations">;
  }) => Promise<string>;
  navigate: (path: string) => void;
  setLogo: (args: {
    organizationId: Id<"organizations">;
    storageId: Id<"_storage">;
  }) => Promise<unknown>;
  uploadImage: (blob: Blob, uploadUrl: string) => Promise<Id<"_storage">>;
}) {
  const [name, setName] = useState("");
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdOrganization, setCreatedOrganization] = useState<{
    id: Id<"organizations">;
    slug: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  async function stageLogo(blob: Blob) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoBlob(blob);
    setLogoPreview(URL.createObjectURL(blob));
  }

  async function removeStagedLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoBlob(null);
    setLogoPreview(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    let organizationCreated = Boolean(createdOrganization);

    try {
      const organization =
        createdOrganization ?? (await createOrganization({ name }));
      if (!createdOrganization) {
        setCreatedOrganization({
          id: organization.id,
          slug: organization.slug,
        });
        organizationCreated = true;
      }
      if (logoBlob) {
        const uploadUrl = await generateUploadUrl({
          organizationId: organization.id,
        });
        const storageId = await uploadImage(logoBlob, uploadUrl);
        await setLogo({ organizationId: organization.id, storageId });
      }
      navigate(`/org/${organization.slug}/dashboard`);
    } catch (caught) {
      setError(
        organizationCreated
          ? "Your Organization was created, but the logo upload failed. Retry or continue without it."
          : caught instanceof Error
            ? caught.message
            : "Unable to create the Organization.",
      );
      setPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input
          autoComplete="organization"
          id="organization-name"
          maxLength={80}
          minLength={2}
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Holdings"
          required
          value={name}
        />
        <p className="text-muted-foreground text-xs leading-5">
          The URL is created once from this name and remains stable after a
          rename.
        </p>
      </div>

      <div className="border-t pt-5">
        <ProfileImageControl
          alt={`${name || "New Organization"} logo`}
          cropShape="rect"
          fallback={(name.trim().slice(0, 2) || "OR").toUpperCase()}
          imageUrl={logoPreview}
          label="Organization logo (optional)"
          onRemove={removeStagedLogo}
          onUpload={stageLogo}
        />
      </div>

      {error ? (
        <p
          aria-live="polite"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending
          ? createdOrganization
            ? "Uploading logo…"
            : "Creating Organization…"
          : createdOrganization
            ? "Retry logo and continue"
            : "Create Organization"}
      </Button>
      {createdOrganization ? (
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => navigate(`/org/${createdOrganization.slug}/dashboard`)}
          type="button"
          variant="ghost"
        >
          Continue without logo
        </Button>
      ) : null}
    </form>
  );
}
