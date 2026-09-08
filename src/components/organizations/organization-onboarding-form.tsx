"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  defaultCollectionFormTitle,
  publicSlugFromBrandName,
} from "@convex/domain/brand";
import { ArrowNote } from "@/components/doodles";
import { CollectionFormPreview } from "@/components/organizations/collection-form-preview";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadProfileImage } from "@/lib/upload-profile-image";

type CreateBrandArgs = {
  collectionFormDescription: string;
  collectionFormTitle: string;
  name: string;
  primaryColor: string;
  privacyContact: string;
  publicSlug: string;
};

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
  createOrganization: (args: CreateBrandArgs) => Promise<{
    id: Id<"organizations">;
    publicSlug: string;
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
  const [publicSlug, setPublicSlug] = useState("");
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [collectionFormTitle, setCollectionFormTitle] = useState("");
  const [titleWasEdited, setTitleWasEdited] = useState(false);
  const [collectionFormDescription, setCollectionFormDescription] = useState(
    "Tell us what changed for you.",
  );
  const [privacyContact, setPrivacyContact] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FFBB16");
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdOrganization, setCreatedOrganization] = useState<{
    id: Id<"organizations">;
    publicSlug: string;
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

  function updateName(nextName: string) {
    setName(nextName);
    if (!slugWasEdited) setPublicSlug(publicSlugFromBrandName(nextName));
    if (!titleWasEdited) {
      setCollectionFormTitle(
        nextName.trim() ? defaultCollectionFormTitle(nextName.trim()) : "",
      );
    }
  }

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
        createdOrganization ??
        (await createOrganization({
          collectionFormDescription,
          collectionFormTitle,
          name,
          primaryColor,
          privacyContact,
          publicSlug,
        }));
      if (!createdOrganization) {
        setCreatedOrganization({
          id: organization.id,
          publicSlug: organization.publicSlug,
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
          ? "Your project was created, but the logo upload failed. Retry or continue without it."
          : caught instanceof Error
            ? caught.message
            : "Unable to create the project.",
      );
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <form className="space-y-6" onSubmit={submit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              autoComplete="organization"
              id="brand-name"
              maxLength={80}
              minLength={2}
              name="name"
              onChange={(event) => updateName(event.target.value)}
              placeholder="Northwind Bakery"
              required
              value={name}
            />
          </Field>
          <Field>
            <Label htmlFor="public-slug">Public slug</Label>
            <Input
              aria-describedby="public-slug-help"
              id="public-slug"
              maxLength={48}
              minLength={2}
              name="publicSlug"
              onChange={(event) => {
                setSlugWasEdited(true);
                setPublicSlug(publicSlugFromBrandName(event.target.value));
              }}
              placeholder="northwind-bakery"
              required
              value={publicSlug}
            />
            <FieldDescription id="public-slug-help">
              Your public address will be /c/{publicSlug || "your-brand"}.
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <Label htmlFor="collection-form-title">Collection Form title</Label>
          <Input
            id="collection-form-title"
            maxLength={100}
            name="collectionFormTitle"
            onChange={(event) => {
              setTitleWasEdited(true);
              setCollectionFormTitle(event.target.value);
            }}
            required
            value={collectionFormTitle}
          />
        </Field>

        <Field>
          <Label htmlFor="collection-form-description">
            Collection Form description
          </Label>
          <Textarea
            id="collection-form-description"
            maxLength={500}
            name="collectionFormDescription"
            onChange={(event) =>
              setCollectionFormDescription(event.target.value)
            }
            value={collectionFormDescription}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
          <Field>
            <Label htmlFor="privacy-contact">Privacy contact</Label>
            <Input
              autoComplete="email"
              id="privacy-contact"
              name="privacyContact"
              onChange={(event) => setPrivacyContact(event.target.value)}
              placeholder="privacy@yourbrand.com"
              required
              type="email"
              value={privacyContact}
            />
          </Field>
          <Field>
            <Label htmlFor="primary-color">Primary color</Label>
            <Input
              className="h-10 cursor-pointer p-1"
              id="primary-color"
              name="primaryColor"
              onChange={(event) => setPrimaryColor(event.target.value)}
              type="color"
              value={primaryColor}
            />
          </Field>
        </div>

        <div className="border-t pt-5">
          <ProfileImageControl
            alt={`${name || "New Brand"} logo`}
            cropShape="rect"
            fallback={(name.trim().slice(0, 2) || "GP").toUpperCase()}
            imageUrl={logoPreview}
            label="Brand logo (optional)"
            onRemove={removeStagedLogo}
            onUpload={stageLogo}
          />
        </div>

        {error ? <ErrorToast message={error} /> : null}
        <Button className="w-full" loading={pending} type="submit">
          {createdOrganization ? "Retry logo and continue" : "Create project"}
        </Button>
        {createdOrganization ? (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              navigate(`/org/${createdOrganization.slug}/dashboard`)
            }
            type="button"
            variant="ghost"
          >
            Continue without logo
          </Button>
        ) : null}
      </form>
      <aside className="space-y-3 lg:sticky lg:top-8">
        <ArrowNote>this is what your customers see</ArrowNote>
        <CollectionFormPreview
          accentColor={primaryColor}
          description={collectionFormDescription}
          logoUrl={logoPreview}
          name={name}
          title={collectionFormTitle}
        />
      </aside>
    </div>
  );
}
